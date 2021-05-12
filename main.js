// 第一引数 "test"の場合テストモード

require('dotenv').config({ path: '../watch_resize_env' })
const env = process.env
//テストモード
const test_mode = (process.argv[2] === "test")
//require
const fs = require("fs")
const path = require("path")
const sys = require("./systemController")
const chokidar = require("chokidar")

require('date-utils')
//ログ記録
const log4js = require('log4js')
const { time } = require("console")
log4js.configure("log-config.json")
const eventLogger = log4js.getLogger('event')

//監視するフォルダーの相対パス
let watch_dir = env.WATCH_DIR
if (!fs.existsSync(watch_dir) ) {
    eventLogger.error(`写真供給側のネットワーク(${watch_dir})に接続されていません。`)
    watch_dir = "../watch"
    sys.check_dir(watch_dir)
}
//写真供給フォルダーのクリア
sys.clear_folder(watch_dir)

eventLogger.info(`写真供給フォルダー: ${watch_dir}`)

const sharp = require('sharp')
const { resolve } = require('path')
const threashold = 30
const testWidth = 200
const readImageFromFileToBuffer = ( file )=> {
    return new Promise( resolve=> {
        sharp(file).resize(testWidth).raw().toBuffer()
            .then( (data) => {
                resolve(data)
            })
            .catch(function(err) {
                console.log(err);
            })
    })
}
const absDifference = ( back, front ) => {
    return new Promise( resolve => {
        const newBuffer=[]
        let index=0;
        while(index<front.length) {
            newBuffer.push(Math.abs(back[index]-front[index]))
            index++
        }
        const max = newBuffer.reduce((a,b)=>a>b?a:b)
        const min = newBuffer.reduce((a,b)=>a<b?a:b)
        const normalizedThreashold = (max+min)/5
        console.log(`max:${max}`)
        console.log(`min:${min}`)
        console.log(`normalizedThreashold:${normalizedThreashold}`)
        let flag = true
        const height = newBuffer.length/(testWidth*3)
        let grade
        for (let i=0; i<height; i++) {
            for ( let j=0; j<testWidth; j++) {
                for ( let k=0; k<3; k++) {
                    let index = (testWidth*i + j)*3+k
                    let value = newBuffer[index]
                    
                    if(flag && value>normalizedThreashold) {
                        console.log(`[${index}]`)
                        grade = Math.ceil(((newBuffer.length - index)/newBuffer.length)*10)
                        flag = false
                    }
                }
                
            }
        }
        
        resolve(grade)
        // resolve(newBuffer)
    })
}
let differenceData
async function eveluateImage(newImage) {
    const bgImageData = await readImageFromFileToBuffer('./images/bg.jpg')
    console.log(`bgImageData[${bgImageData.length}]`)

    const newImageData = await readImageFromFileToBuffer(newImage)
    console.log(`newImageData[${newImageData.length}]`)

    const grade = await absDifference(bgImageData,newImageData)
    console.log(`grade[${grade}]`)
    // const img = sharp(Uint8Array.from(differenceData), {raw: {width: 10, height:1, channels: 3 }})
   
    // await img .jpeg().toFile('./output.jpg')
}
eveluateImage('./images/10.jpg')
    
let bg_image_data = []

readImageFromFileToBuffer('./images/bg.jpg')
.then((data) => {
    bg_image_data = data
})
.then(() => {
    console.log(`bg_image_data[${bg_image_data.length}]`)

    sharp('./images/a.jpg').resize(400).raw().toBuffer()
            .then( (data) => {
                resolve("ok")

            })
            .catch(function(err) {
                console.log(err);
            })
})


//chokidarの初期化
const watcher = chokidar.watch(watch_dir+"/",{
    ignored:/[\/\\]\./,
    persistent:true
})

async function composit(src, dest, frames) {
    const image = sharp(src)

    image
        .resize( 100, 40, {
            // fit: 'outside'
            fit: 'cover'
        } )
        .raw()
        .toBuffer()
        .then( (data) => {
            for ( let i=0; i<60; i += 3) {
                console.log(`red:${data[i]}, green: ${data[i+1]}, blue: ${data[i+2]}`)
                image_data.push(data[i])
                image_data.push(data[i+1])
                image_data.push(data[i+2])
            }
            return new Promise((resolve, reject) => {
                resolve(data);
              });
        })
        .catch(function(err) {
            console.log(err);
        })
}
//監視イベント
watcher.on('ready',function(){

    //準備完了
    // console.clear()
    console.log("フレーム合成プログラム稼働中。")
    if (test_mode) {
        eventLogger.trace("[ テストモード ]")
    }

    //ファイル受け取り
    watcher.on( 'add', function(file_name) {
        const new_name = path.basename(file_name)
        eventLogger.info(`追加されたファイル: ${new_name}`)          
        let exts = new_name.split(".")
        let src = watch_dir + "/" + new_name
        let dest = print_dir + "/" + new_name

        if(exts.length>1) {
            ext=exts[exts.length-1]
            if (ext.toUpperCase() ==="JPG" || ext.toUpperCase() === "JPEG") {
                const a = `${frame_dir}/frame01.png`
                composit(src, dest, [{input: a}]).then((data)=>{
                    console.log(data.length)
                })
           　}
        }
   })
}) //watcher.on('ready',function(){