import { CodeSubmittableResult } from "@polkadot/api-contract/base";
import { CodePromise } from "@polkadot/api-contract";
import { KeyringPair } from "@polkadot/keyring/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { ISubmittableResult } from "@polkadot/types/types";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { WeightV2 } from "@polkadot/types/interfaces";
import { getApi, executeCall, executeCalls, getCall, getContract, getSigner } from "./common_api";
import { buildCatalog, writeTokenMetadata } from "./catalog";
import { loadConfiguration } from "./configuration";
import { OWNER_URI } from "./secret";
import Files from "fs";

export const deployRmrkContract = async (
    signer: KeyringPair,
    name: string,
    symbol: string,
    baseUri: string,
    maxSupply: BigInt,
    pricePerMint: BigInt,
    collectionMetadata: string,
    royaltyReceiver: string,
    royalty: number
): Promise<string> => {
    console.log(`Deploying RMRK smart contract for ${name}`);
    const api = await getApi();
    const owner = getSigner(OWNER_URI);
    const contract = JSON.parse(Files.readFileSync("./contracts/rmrk_contract.contract").toString());
    const code = new CodePromise(api, contract, contract.source.wasm);

    // TODO see how to get gas estimation for CodePromise.
    const tx = code.tx["new"]!(
        {
            gasLimit: api.registry.createType("WeightV2", {
                refTime: 2_000_000_000,
                proofSize: 50_000,
            }) as WeightV2,
            storageDepositLimit: BigInt("100000000000000000000"),
        },
        name,
        symbol,
        baseUri,
        maxSupply,
        pricePerMint,
        collectionMetadata,
        royaltyReceiver,
        royalty
    );

    return await signAndSend(tx, signer);
};

export const deployCatalogContract = async (catalogMetadataUri: string, signer: KeyringPair) => {
    console.log(`Deploying RMRK catalog smart contract`);
    const api = await getApi();
    const contract = JSON.parse(Files.readFileSync("./contracts/catalog_contract.contract").toString());
    const code = new CodePromise(api, contract, contract.source.wasm);
    const tx = code.tx["new"]!(
        {
            gasLimit: api.registry.createType("WeightV2", {
                refTime: 2_000_000_000,
                proofSize: 50_000,
            }) as WeightV2,
            storageDepositLimit: BigInt("100000000000000000000"),
        },
        catalogMetadataUri
    );

    return await signAndSend(tx, signer);
};

const signAndSend = async (
    tx: SubmittableExtrinsic<"promise", ISubmittableResult>,
    signer: KeyringPair
): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        await tx.signAndSend(signer, (result: CodeSubmittableResult<"promise">) => {
            if (result.isFinalized && !result.dispatchError) {
                resolve(result.contract!.address.toHuman());
            } else if (result.isFinalized && result.dispatchError) {
                reject(result.dispatchError.toHuman());
            } else if (result.isError) {
                reject(result.toHuman());
            }
        });
    });
};

export const buildCollection = async (basePath: string, parentContractAddress?: string): Promise<string> => {
    let calls: SubmittableExtrinsic<"promise", ISubmittableResult>[] = [];

    await cryptoWaitReady();
    const signer = getSigner(OWNER_URI);

    // Load collection configuration.
    const configuration = loadConfiguration(basePath);
    console.debug(configuration);

    let contractAddress: string;
    if (!configuration.contractAddress) {
        contractAddress = await deployRmrkContract(
            signer,
            configuration.name,
            configuration.symbol,
            configuration.baseUri,
            BigInt(configuration.maxSupply),
            BigInt(configuration.pricePerMint),
            configuration.collectionMetadataUri,
            configuration.royaltyReceiverAddress,
            configuration.royalty
        );
    } else {
        contractAddress = configuration.contractAddress;
    }

    console.log(`Contract for collection ${configuration.name} has been deployed at address ${contractAddress}`);

    // Build catalog. A lot of magic happens inside.
    const { contractAddress: catalogAddress, catalog } = await buildCatalog(signer, basePath);

    // Write metadata.
    if (!configuration.baseUri) {
        writeTokenMetadata(basePath, catalog, configuration);
        return "";
    }

    // Create contract instance.
    const contract = await getContract(contractAddress);

    // Mint tokens
    calls.push(await getCall(contract, "minting::mintMany", signer, signer.address, configuration.maxSupply));

    // Execute mintMany and addPartList calls
    console.log(`Executing  mintMany and addPartList calls. Number of calls ${calls.length}`);
    await executeCalls(calls, signer);
    console.log("Batch call executed.");
    calls = [];

    // Create assets
    const assetsCount = catalog.length - configuration.numberOfEquippableSlots;
    const equippableSlots: number[] = [];
    for (let i = assetsCount; i < catalog.length; i++) {
        equippableSlots.push(i);
    }

    for (let i = 0; i < assetsCount; i++) {
        calls.push(
            await getCall(
                contract,
                "multiAsset::addAssetEntry",
                signer,
                (i + 1).toString(), // Asset id
                "0", // Equippable group id
                catalog[i].partUri, // Asset uri
                [i, ...equippableSlots]
            )
        );
    }

    // Execute add asset entry calls
    console.log(`Executing addAssetEntry calls. Number of calls ${calls.length}`);
    await executeCalls(calls, signer);
    console.log("Batch call executed.");
    calls = [];

    // Add assets to a token
    for (let i = 0; i < configuration.maxSupply; i++) {
        calls.push(
            await getCall(
                contract,
                "multiAsset::addAssetToToken",
                signer,
                { u64: i + 1 }, // Token Id
                ((i % assetsCount) + 1).toString(), // Asset Id
                null
            )
        );
    }

    // Execute all add asset to token calls
    console.log("Executing addAssetToToken");
    await executeCalls(calls, signer);
    console.log("Batch call executed.");

    // Add child tokens
    if (parentContractAddress) {
        calls = [];
        // Generate array from 1 to maxSupply and shuffle members.
        const shuffledTokenIds = Array.from({ length: configuration.maxSupply }, (_, index) => index + 1).sort(
            () => Math.random() - 0.5
        );

        // Approve parent
        await executeCall(
            contract,
            "psp34::approve",
            signer,
            parentContractAddress,
            null, //Calling approve without providing token id allows contract owner to add child, TODO check the contract code.
            true
        );

        const parentContract = await getContract(parentContractAddress);
        for (let i = 0; i < configuration.maxSupply; i++) {
            calls.push(
                await getCall(
                    parentContract,
                    "nesting::addChild",
                    signer,
                    { u64: i + 1 }, // Parent token Id
                    [contractAddress, { u64: shuffledTokenIds[i] }]
                )
            );
        }

        console.log("Executing addChild batch");
        await executeCalls(calls, signer);
        console.log("Batch call executed.");
    }

    console.log("Script completed");
    return contractAddress!;
};
