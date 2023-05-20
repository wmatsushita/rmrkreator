import fs from "fs";
import path from "path";
import { executeCall, getCatalogContract } from "./common_api";
import { KeyringPair } from "@polkadot/keyring/types";
import { CollectionConfiguration, Metadata } from "./base";
import { loadConfiguration } from "./configuration";
import { deployCatalogContract } from "./contract";

export type PartType = "None" | "Slot" | "Fixed";

export interface IBasePart {
    id?: string | number;
    partType: PartType;
    equippable?: string[] | "*";
    partUri?: string;
    metadataUri?: string;
    isEquippableByAll?: boolean;
    z?: number;
}

export interface Catalog {
    contractAddress: string;
    catalog: IBasePart[];
}

export const buildCatalog = async (signer: KeyringPair, basePath: string): Promise<Catalog> => {
    const configuration = loadConfiguration(basePath);

    const contractAddress = await deployCatalogContract(configuration.catalogMetadataUri, signer);
    console.log(
        `Catalog contract for collection ${configuration.name} has been deployed at address ${contractAddress}`
    );

    // Create catalog.
    const catalog = await createCatalog(
        contractAddress,
        configuration.numberOfEquippableSlots,
        basePath,
        configuration.collectionImagesUri
    );

    const contract = await getCatalogContract(contractAddress);
    //await executeCall(contract, "catalog::addPartList", signer, catalog);
    await executeCall(contract, "catalog::addPartList", signer, catalog);

    return { contractAddress, catalog };
};

export const createCatalog = async (
    contractAddress: string,
    numberOfSlots: number,
    basePath: string,
    imagesUri: string
): Promise<IBasePart[]> => {
    const result: IBasePart[] = [];
    const fixedParts: number[] = [];
    const assetsPath = `${basePath}assets`;

    console.log("Creating a catalog");
    // Create fixed parts.
    // TODO see how to exclude hidden files (e.g. .DS_Store)
    const folders = fs
        .readdirSync(assetsPath, { withFileTypes: true })
        .filter((x) => x.isDirectory() && x.name !== ".DS_Store")
        .map((x) => x.name);

    for (let folder of folders) {
        const z = parseInt(folder.split("_")[0]);
        fixedParts.push(z);
        const files = await fs.promises.readdir(`${assetsPath}/${folder}`);
        for (let file of files.filter((x) => x !== ".DS_Store")) {
            result.push({
                partType: "Fixed",
                partUri: `${imagesUri}/${folder}/${file}`,
                z,
            });
        }
    }

    // Create slots. Assumption, slots z order fills holes between fixed parts z indices.
    let slotsAdded = 0;
    for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
        if (slotsAdded >= numberOfSlots) {
            break;
        }

        if (fixedParts.indexOf(i) === -1) {
            result.push({
                partType: "Slot",
                //equippable: [contractAddress],
                equippable: [],
                z: i,
            });
            slotsAdded++;
        }
    }

    return result;
};

export const writeTokenMetadata = (
    basePath: string,
    parts: IBasePart[],
    configuration: CollectionConfiguration
): // ... existing parameters
void => {
    const fixedPartsCount = parts.filter((x) => x.partType === "Fixed").length;
    const metadataPath = `${basePath}metadata/`;

    // We will reuse base parts. Every fixedPartsCount th token will have the same base part.
    for (let i = 0; i < configuration.maxSupply; i++) {
        const part = parts[i % fixedPartsCount];

        if (!part.partUri) {
            continue;
        }

        const meta = {
            name: `${configuration.name} #${i + 1}`,
            description: configuration.description,
            image: part.partUri,
            properties: {
                type: {
                    type: "string",
                    value: path.parse(part.partUri).name,
                },
            },
        } as Metadata;

        fs.writeFileSync(`${metadataPath}${i + 1}.json`, JSON.stringify(meta, null, 4), "utf-8");
    }

    console.log("Tokens metadata have been created.");
};
