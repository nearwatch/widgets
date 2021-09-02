const ccxt      = require('ccxt')
const exchange  = new ccxt.binance({apiKey:process.env.BINANCE_KEY, secret:process.env.BINANCE_SECRET, timeout:30000, enableRateLimit:true, options:{adjustForTimeDifference:true}})
const sleep     = (millis) => new Promise(resolve => setTimeout(resolve, millis))
const pairs     = ['NEAR/USDT','USDT/RUB','USDT/UAH'] 
const dates     = []
let history     = {}

async function getCourses(){
	try {
		return await exchange.fetchTickers(pairs.join(','))
	} catch(err) {
		console.error(err)
		return {error:err}
	}
}
async function getHistory(pair){
	try {
		return await exchange.fetchOHLCV(pair,'1d',Date.now()-2678400000)
	} catch(err) {return {error:err}}
}
async function getData(){
	if (dates.length && Date.now()-dates[dates.length-1]>86400000) {
		dates.length = 0
		history	= {}
	}
	if (!dates.length){
		for (const pair of pairs){
			console.log('loading history '+pair)
			const raw = await getHistory(pair)
			if (raw && raw.error){
				console.log(raw.error)
				history.length = 0
				return raw
			}	
			for (const day of raw){
				if (!history['u'+day[0]]) history['u'+day[0]] = {}
				history['u'+day[0]][pair] = day[4] 
				if (dates.indexOf(day[0])<0) dates.push(day[0])
			}
			await sleep(1000)
		}
		dates.sort()
	}
	const d = Date.now()
	const date = d-(d%86400000)
	const raw = await getCourses()	
	if (!raw || raw.error) return raw?raw:{error:'no data'}
	
	if (dates.indexOf(date)<0) dates.push(date)
	for (const pair of pairs)
		if (raw[pair] && raw[pair].last) history['u'+date][pair] = raw[pair].last
	const result = {nearusd:[], nearrub:[], nearuah:[]}
	for (const time of dates){
		if (history['u'+time][pairs[0]]) 								result.nearusd.push({date:time, price:history['u'+time][pairs[0]]})
		if (history['u'+time][pairs[0]] && history['u'+time][pairs[1]]) result.nearrub.push({date:time, price:history['u'+time][pairs[0]]*history['u'+time][pairs[1]]})
		if (history['u'+time][pairs[0]] && history['u'+time][pairs[2]]) result.nearuah.push({date:time, price:history['u'+time][pairs[0]]*history['u'+time][pairs[2]]})
	}
	return result
}

module.exports = {getData}
