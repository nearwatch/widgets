const fs        = require('fs')
const nearApi   = require('near-api-js')

const network   = 'mainnet'
const config    = {networkId:network, nodeUrl:'https://rpc.'+network+'.near.org', walletUrl:'https://wallet.'+network+'.near.org', helperUrl:'https://helper.'+network+'.near.org',explorerUrl: 'https://explorer.'+network+'.near.org'}
const accounts  = {}, mainId = process.env.NFT_ACCOUNT

format = (value) => nearApi.utils.format.formatNearAmount(''+value)
loadAccount = async (id,key) => {
	try{
		const keyPair = nearApi.utils.KeyPair.fromString(key)
		const keyStore = new nearApi.keyStores.InMemoryKeyStore()
		keyStore.setKey(config.networkId,id,keyPair)
		const near = await nearApi.connect({deps:{keyStore},...config})
		return await near.account(id)
	}catch(err) {
		return {error:err.type || err}
	}
}
mintNFT = async (tokenId, metadata) => {
    try {
		const tx = await accounts.nft.functionCall({contractId:mainId, methodName:'nft_mint', args:{token_id:tokenId, token_owner_id:mainId, token_metadata:metadata}, gas:'100000000000000',attachedDeposit:'1000000000000000000000000'})
        return tx.status.Failure?{error:tx.status.Failure}:tx.transaction.hash
	}catch(err) {
		return {error:err.type || err}
	}
}
transferNFT = async (tokenId, receiverId, memo, copies=1) => {
    try {
		const tx = await accounts.nft.functionCall({contractId:mainId, methodName:'nft_transfer', args:{token_id:tokenId, receiver_id:receiverId, memo:memo, copies:copies}, gas:'100000000000000',attachedDeposit:'1'})
        return tx.status.Failure?{error:tx.status.Failure}:tx.transaction.hash
	}catch(err){
		return {error:err.type || err}
	}
}
load = async () => {
	const postfix = '.widget.'+(network=='testnet'?network:'near')
	accounts.nft = await loadAccount('nft'+postfix,process.env.NFT_KEY)
}
load()

module.exports = {format,mintNFT,transferNFT}
