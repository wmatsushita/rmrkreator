import { exec } from "child_process";

const scriptPath = "node_modules/@727-ventures/typechain-polkadot/index.ts";
const inputPath = "rmrk-nft-contract/rmrk_nft/target/ink";
const outputPath = "cli/src/typed_contracts";

exec(`npx ts-node -r ts-node/register ${scriptPath} --in ${inputPath} --out ${outputPath}`, (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
});
