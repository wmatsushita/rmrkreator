import fs from "fs";
import { CollectionConfiguration } from "./base";

export const loadConfiguration = (assetsPath: string): CollectionConfiguration => {
    console.log(`Loading collection configuration from ${assetsPath}`);
    const config = JSON.parse(fs.readFileSync(`${assetsPath}configuration.json`, "utf-8"));

    // Add configuration validation here

    return <CollectionConfiguration>config;
};
