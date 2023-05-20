import { buildCollection } from "./contract";

const run = async (): Promise<void> => {
    // Base contract
    const baseAddress = await buildCollection("./collections/starduster/");
    // Child contracts
    await buildCollection("./collections/starduster-eyes/", baseAddress);
    await buildCollection("./collections/starduster-mouths/", baseAddress);
    await buildCollection("./collections/starduster-headwear/", baseAddress);
    await buildCollection("./collections/starduster-farts/", baseAddress);

    console.log("\nBase contract address ", baseAddress);
    process.exit(0);
};

run();
