const fetch       = require('node-fetch')
const querystring = require('querystring')
const near        = require('./near')
const charts      = require('./charts')
const ldb         = require('./lbases')

getRawTxs = async function (cur){
	try{
		const url = 'https://helper.mainnet.near.org/account/'+cur+'.widget.near/activity'  
		const res = await fetch(url,{timeout:3000}) 
		if (res.status<199 || res.status>299) {return {error:res.statusText+' ('+res.status+')'}}
		const text = await res.text()
		try{
			return JSON.parse(text)
		} catch(err){return {error:text}}
	}catch(err){return {error:err}}
}
setTx = async function (tx_in){
	const id = tx_in.id
	const res = await ldb.getRec('lvTxs',id)
	if (res) return
	delete tx_in.id
	const tx = await ldb.setRec('lvTxs',id,tx_in)
	if (tx.err) return 
	await ldb.setRec('lvUTxs',tx.sender+'_'+id,'',1)
	await ldb.setRec('lvUTxs',tx.receiver+'_'+id,'',1)
	if (tx.value<1) return
	const atx = await ldb.getRec('lvActTxs',id)
	if (!atx) await ldb.setRec('lvActTxs',id,tx)
}	
getTxs = async function (cur){
	let txs = await getRawTxs(cur)	
	if (txs.error) return txs
	txs = txs.filter(e => e.action_kind == 'TRANSFER' && e.args && e.args.deposit && e.signer_id.indexOf('widget.testnet')<0 && e.signer_id.indexOf('widget.near')<0)
	txs = txs.map(e => ({id:e.block_timestamp+e.receiver_id.substr(0,3), type:e.receiver_id.substr(0,3), hash:e.hash, sender:e.signer_id, receiver:e.receiver_id, value:+near.format(e.args.deposit)}))
	for (const tx of txs) await setTx(tx)
	return txs
}
getAllTxs = async function (){
	await getTxs('usd')
	await getTxs('rub')
	await getTxs('uah')
	await getTxs('ref')
	await getTxs('inf')
}
setInterval(getAllTxs,11000)

getActive = async function (){
	const list = await ldb.rlist('lvActTxs')
	if (list.err || !list.length) return
	const tx = await ldb.delRec('lvActTxs',list[0].key)
	const ticker = ',inf,ref'.indexOf(list[0].type)<0?'near'+list[0].type:list[0].type
	const id = await charts.sendNFT(ticker,list[0].sender)
	if (id.error) return console.log('NFT sending error\n'+id.error+'\nfrom '+list[0].sender+'\n\nexplorer.mainnet.near.org/transactions/'+tx.hash)
	await ldb.updRec('lvTxs',list[0].key,{result:id})
	return console.log('sent '+list[0].type+' NFT to <a href="https://explorer.mainnet.near.org/accounts/'+list[0].sender+'">'+list[0].sender+'</a>\nnear.watch/charts/'+id+'\n\nexplorer.mainnet.near.org/transactions/'+tx.hash)
}	
setInterval(getActive,15000)
