import useSWR from "swr";
import {useEffect} from "react";

const NETWORKS = {
    1: "Ethereum Main Network",
    2: "Morden Test network",
    3: "Ropsten Test Network",
    4: "Rinkeby Test Network",
    5: "Goerli Test Network",
    42: "Kovan Test Network",
    56: "Binance Smart Chain",
    97: "Binance Smart Chain Testnet",
    1337: "Ganache",
    11155111: "Sepolia Test Network",
}

const targetNetwork = NETWORKS[process.env.NEXT_PUBLIC_TARGET_CHAIN_ID]

export const handler = (web3) => () => {
    const { error, data, ...rest } = useSWR(() => web3 ? "web3/network" : null,
        async () => {
            const chainId = await web3.eth.getChainId()

            if (!chainId) {
                throw new Error("Cannot retrieve network. Please check your connection.")
            }

            return NETWORKS[chainId]
        }
    )

    return {
        target: targetNetwork,
        isSupported: targetNetwork === data,
        data,
        ...rest
    }
}
