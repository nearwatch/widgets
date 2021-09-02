const dbPath = './db/'
const level  = require('level')
const bases  = {
	lvWidget	:level(dbPath+'widgets'),
	lvRef		:level(dbPath+'ref'),
	lvTxs		:level(dbPath+'txs'),
	lvUTxs		:level(dbPath+'utxs'),
	lvActTxs	:level(dbPath+'atxs'),
	lvStatUser	:level(dbPath+'statusers'),
	lvTxsHist	:level(dbPath+'txshistory')
}

getRec 	= async function (basename,id,nojson) {
	if (!id) return {err:'unknown ID'}
	let x
    try {
		x = await bases[basename].get(id)
        return nojson?x:JSON.parse(x)
    } catch(err){return (err.toString().substr(0,14) == 'NotFoundError:')?null:{err:x?x:''}}
}
setRec 	= async function (basename,id,data,nojson) {
    try {
        await bases[basename].put(id,nojson?data:JSON.stringify(data))
        return data
    } catch(err) {return {err:err}}
}
updRec 	= async function (basename,id,data) {
    let x = await getRec(basename,id)
    if (!x) x = {}
    if (x.err) return x
    try {
        Object.keys(data).forEach(key => {x[key] = data[key]})
        await bases[basename].put(id,JSON.stringify(x))
        return x
    } catch(err) {return {err:err}}
}
delRec 	= async function (basename,id,nojson) {
    let x = await getRec(basename,id,nojson)
    if (x) {
        try {
            await bases[basename].del(id)
        } catch(err) {
			return {err:err}
		}
    }
    return x
}
batch  	= async function (basename,list) {
	try {
		await bases[basename].batch(list)
	} catch(err) {return {err:err}}		
	return {status:'OK'}
}	
rlist	= function (basename,prefix = {},mode,nojson){
    return new Promise((resolve, reject) => {
        const list = [], res = {deal:0, maxsize:0}, options = {keys:true, values:true, ...prefix}
		if (typeof prefix == 'string'){
			options.gt = prefix
			options.lt = prefix+'\uFFFF'
		} 
        bases[basename].createReadStream(options)
            .on('data',(data)  => {
				switch (mode){
					case 'count':
						res.deal++
						if (res.maxsize<data.value.length) res.maxsize = data.value.length
						break
					case 'keys':
						list.push(data.key)					
						break
					case 'values':
						list.push(nojson?data.value:JSON.parse(data.value))
						break
					default:
						list.push(nojson?{key:data.key,value:data.value}:{key:data.key, ...JSON.parse(data.value)})					
				}
			})
            .on('error', (err) => resolve({err:err}))
            .on('close', () => resolve(mode=='count'?res:list))
    })
}

module.exports = {getRec,setRec,updRec,delRec,batch,rlist}
