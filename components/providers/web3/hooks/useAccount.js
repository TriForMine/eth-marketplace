import { useEffect } from "react";
import useSWR from "swr"

const adminAddresses = {
    "0xc27f0fa2a7553ac2897e3e415d6614221031fd19869d0363b4245e6f940228f1": true,
    "0xe877d594a9f6856263ecd8aa420584fb4a1fc00650678a8bf9ef12397a939108": true
}

export const handler = (web3, provider) => () => {
    const { data, mutate, ...rest } = useSWR(
        () => {
            return web3 !== null ? "web3/accounts" : null
        },
        async () => {
            const accounts = await web3.eth.getAccounts()
            const account = accounts[0]

            if (!account) {
                throw new Error("Cannot retrieve an account. Please refresh the browser.")
            }

            return account
        }
    )

    useEffect(() => {
        const mutator = accounts => mutate(accounts[0] ?? null)
        provider?.on("accountsChanged", mutator)

        return () => {
            provider?.removeListener("accountsChanged", mutator)
        }
    }, [mutate])

    return {
        isAdmin: (data && adminAddresses[web3.utils.keccak256(data)]) ?? false,
        mutate,
        data,
        ...rest
    }
}
