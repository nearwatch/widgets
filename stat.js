const fs       = require('fs')
const {Client} = require('pg')
const near     = require('./near')
const ldb      = require('./lbases')

const getHistory = async function (accountId, full){
	try {
		const client = new Client({user:'public_readonly',host:'104.199.89.51',database:'mainnet_explorer',password:'nearprotocol',port:5432})
		await client.connect()
		const time = ((Date.now() - (full?365:1)*24*60*60*1000)*1000000).toString()
		const parameters = [accountId,full?5000:300] 
		const query = "SELECT * FROM action_receipt_actions WHERE (receipt_included_in_block_timestamp>"+time+" AND action_kind='TRANSFER' AND receipt_predecessor_account_id!=receipt_receiver_account_id AND receipt_predecessor_account_id!='system' AND (receipt_receiver_account_id = $1 OR receipt_predecessor_account_id = $1)) LIMIT $2" // ORDER BY receipt_included_in_block_timestamp DESC 
		const response = await client.query(query,parameters)
		client.end()
		if (!response || !response.rows  || !response.rows.length) return {error:'no data'}
		const list = response.rows.filter(e => e.args && e.args.deposit).map(e => ({id:e.receipt_id, timestamp:e.receipt_included_in_block_timestamp, sender:e.receipt_predecessor_account_id, receiver:e.receipt_receiver_account_id, value:e.args.deposit}))
		return list
	}catch(err) {return {error:err}}
	return {error:'no data'}
}	
const updateHistory = async function (accountId, full, clear){
	if (clear){
		const list = await ldb.rlist('lvTxsHist',accountId+'_','keys')
		if (list && !list.error) await ldb.batch('lvTxsHist',list.map(e => ({type:'del', key:e})))
	}
	const count = await ldb.rlist('lvTxsHist',{gt:accountId+'_', lt:accountId+'_\uFFFF', limit:1},'count')
	const txs = await getHistory(accountId, full || (count && count.deal == 0))
	if (!txs || txs.error) return console.log(txs && txs.error)
	const batch = []
	for (const tx of txs) batch.push({type:'put', key:accountId+'_'+tx.timestamp+'_'+tx.id, value:JSON.stringify({v:(tx.sender == accountId?-1:1)*+(near.format(tx.value).replace(/\,/g,'')), c:tx.sender == accountId ?tx.receiver:tx.sender})})
	await ldb.batch('lvTxsHist',batch)
}	
function drawStat(accountId,data){
	try {
		const timestr = new Date().toISOString().split('T')[0]
		let template = '<svg version="1.1" width="327" height="327" xmlns="http://www.w3.org/2000/svg">'+
		'<rect x="5" y="5" width="317" height="282" fill="#fff" stroke="black" stroke-width="0.2"/>'+ 
		'<rect x="15" y="15" width="304" height="44" fill="#fff"/>'+ 
		'<text x="315" y="22" fill="#888" font-size="12" font-family="Tahoma" text-anchor="end">'+timestr+'</text>'+
		'<text x="164" y="308" fill="#9db2bd" font-size="12" text-anchor="middle" font-family="Tahoma">open in a new tab for more statistics on the account</text>'+
		'<text x="164" y="323" fill="#9db2bd" font-size="12" text-anchor="middle" font-family="Tahoma">to buy this NFT send 1 NEAR to inf.widget.near</text>'+
		'<g><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">'+
		'</svg></g>'
		for (let i=0;i<data.length;i++){
			if (data[i]){
				if (i>8) break
				let name = data[i].key
				if (name == '7747991786f445efb658b69857eadc7a57b6b475beec26ed14da8bc35bb2b5b6') name = 'BINANCE'
				if (name.length>32) name = name.substr(0,5)+'...'+name.substr(-10)
				template += '<rect x="10" y="'+(26*i+35)+'" width="307" height="24" fill="'+(i%2?'#eee':'#fff')+'"/>'
				template += '<text x="313" y="'+(26*i+53)+'" fill="#888" text-anchor="end" font-size="16" font-family="Tahoma">'+name+'</text>\n'
				if (Math.round(data[i].in)>0 || data[i].out == 0){
					template += '<rect x="20" y="'+(26*i+35)+'" width="90" height="24" fill="'+(i%2?'#eee':'#fff')+'"/>'
					template += '<text x="20" y="'+(26*i+54)+'" fill="green" font-size="18" font-weight="bold" font-family="Tahoma">▼'+Math.round(data[i].in)+'</text>\n'
				}	
				if (Math.round(data[i].out)<0 || (data[i].out<0 && Math.round(data[i].in) == 0)){
					template += '<rect x="'+(Math.round(data[i].in)?100:20)+'" y="'+(26*i+35)+'" width="90" height="24" fill="'+(i%2?'#eee':'#fff')+'"/>'
					template += '<text x="'+(Math.round(data[i].in)?100:20)+'" y="'+(26*i+54)+'" fill="red" font-size="18" font-weight="bold" font-family="Tahoma">▲'+Math.abs(Math.round(data[i].out))+'</text>\n'
				}	
			}
		}	
		template += '</svg>' 
		fs.writeFile('./db/'+accountId+'_out.svg',template,err => {if (err) console.log(err)})
	}catch(err) {console.log(err)}
}	
const generateStat = async function (accountId){
	const list = await ldb.rlist('lvTxsHist',{gt:accountId+'_', lt:accountId+'_\uFFFF'})
	const data = {}
	for (const tx of list){
		if (!data[tx.c]) data[tx.c] = {key:tx.c, in:0, out:0, weight:0} 
		if (tx.v<0) data[tx.c].out += tx.v 
		else data[tx.c].in += tx.v 
		data[tx.c].weight += Math.abs(tx.v)
	}
	const table = Object.values(data)
	table.sort((a,b) => b.weight-a.weight)
	drawStat(accountId,table)
}	
const addUser	= async function (accountId, full, clear){
	await updateHistory(accountId, full, clear)
	await generateStat(accountId)
	return await ldb.setRec('lvStatUser',accountId,{last:Date.now()})
}
const makeStat	= async function (){
	const users = await ldb.rlist('lvStatUser')
	if (users.err) return
	const user = users.find(e => !e.last || (Date.now()-e.last > 4*60*60*1000))
	if (user) await addUser(user.key)
}
setInterval(makeStat,300000)

module.exports = {generateStat,updateHistory,addUser}
