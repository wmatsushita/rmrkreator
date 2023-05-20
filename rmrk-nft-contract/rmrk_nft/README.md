# Project Name

Effortlessly create, randomize, and mint unique RMRK NFTs using the Ink! smart contract language with rmrkreator, a powerful CLI tool designed to streamline the NFT creation process and distribution.

## Building the Smart Contract

There is a known issue with the latest version of the nightly toolchain, so you need to downgrade it.
One version that has been confirmed to work is `nightly-2023-03-01`.
Follow these steps to downgrade it:

```
rustup toolchain install nightly-2023-03-01
rustup override set nightly-2023-03-01
rustup component add rust-src --toolchain nightly-2023-03-01-x86_64-unknown-linux-gnu
```

The RMRK contract should be written under the rmrk-nft-contract folder. There is an example set up on the folder `rmrk-nft-contract/rmrk_nft`.
So, in order to build the example, go the folder above:

```
cd rmrk-nft-contract/rmrk_nft
cargo contract build --release
```

Three files will be crated under the `rmrk-nft-contract/rmrk_nft/target/ink` folder:

-   rmrk_example_equippable.contract (code + metadata)
-   rmrk_example_equippable.wasm (the contract's code)
-   rmrk_example_equippable.json (the contract's metadata)
