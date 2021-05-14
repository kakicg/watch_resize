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
let watch_dir = env.WATCH_DIR || '../watch'
if (!fs.existsSync(watch_dir) ) {
    eventLogger.error(`写真供給側のネットワーク(${watch_dir})に接続されていません。`)
    watch_dir = "../watch"
    sys.check_dir(watch_dir)
}
//写真供給フォルダーのクリア
sys.clear_folder(watch_dir)

//リサイズ画像のフォルダー
let resized_dir = env.RESIZED_DIR || '../resized'
if (!fs.existsSync(resized_dir) ) {
    eventLogger.error(`画像書込み側のネットワーク(${resized_dir})に接続されていません。`);
    resized_dir = "../resized"
    sys.check_dir(resized_dir)
}

//元画像のフォルダー
let original_dir = env.ORIGINAL_DIR || '../original'
if (!fs.existsSync(original_dir) ) {
    eventLogger.error(`画像書込み側のネットワーク(${original_dir})に接続されていません。`);
    original_dir = "../original"
    sys.check_dir(original_dir)
}

eventLogger.info(`写真供給フォルダー: ${watch_dir}`)

const sharp = require('sharp')
const { resolve } = require('path')
const testWidth = 200
const testHeight = 200
const finalWidth = 1200;
const readImageFromFileToBuffer = ( file )=> {
    const image = sharp(file)
    return new Promise( (resolve, reject)=> {
        image
        .metadata().then(function(metadata) {
            width = Math.round(metadata.width/2);
            height = metadata.height;
            offset_x = Math.round( width/2 );
            offset_y = 0;  
            return image.extract({ left: offset_x, top: offset_y, width: width, height: height })
            .resize(testWidth,testHeight,{fit: 'fill'})
            .raw().toBuffer()
        })
        .then( (data) => {
            resolve(data)
        })
        .catch(function(err) {
            console.log(err);
            reject(err)
        })
    })
}
const resizeImageFromFileToFile = ( fileName, grade )=> {
    const image = sharp(`${watch_dir}/${fileName}`)
    return new Promise( (resolve, reject)=> {
        image
        .metadata().then(function(metadata) {
            width = Math.round(metadata.width/10*grade)
            height = Math.round(metadata.height/10*grade)
            offset_x = Math.round( (metadata.width-width)/2 );
            offset_y = metadata.height - height  
            return image.extract({ left: offset_x, top: offset_y, width: width, height: height })
            .resize(finalWidth)
            .jpeg().toFile(`${resized_dir}/${fileName}`)
        })
        .then( () => {
            resolve()
        })
        .catch(function(err) {
            console.log(err);
            reject(err)
        })
    })
}
const keepOriginal = (fileName) => {
    const image = sharp(`${watch_dir}/${fileName}`)
    return new Promise( (resolve, reject)=> {
        image
        .resize(finalWidth)
        .toFile(`${original_dir}/${fileName}`)
        .then( () => {
            resolve()
        })
        .catch(function(err) {
            console.log(err);
            reject(err)
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
    })
}
const removeFile = ( path )=> {
    return new Promise( (resolve, reject) => {
        try {
            sys.remove_file(path)
            resolve()
        } catch {
            reject()
        }
    })
}
async function eveluateImage(fileName) {
    // bgImageData = await readImageFromFileToBuffer('./images/bg.jpg')
    // console.log(`bgImageData[${bgImageData.length}]`)

    const newImageData = await readImageFromFileToBuffer(`${watch_dir}/${fileName}`)
    const grade = await absDifference(bgImageData,newImageData)
    console.log(`grade[${grade}]`)
    await resizeImageFromFileToFile(fileName, grade )
    await keepOriginal(fileName)
    await removeFile(`${watch_dir}/${fileName}`)
}
let bgImageData
readImageFromFileToBuffer('./images/bg.jpg')
.then((data) => {
    bgImageData = data
})
.then(() => {
    console.log(`bgImageData[[${bgImageData.length}]]`)
})


//chokidarの初期化
const watcher = chokidar.watch(watch_dir+"/",{
    ignored:/[\/\\]\./,
    persistent:true
})

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

        if(exts.length>1) {
            ext=exts[exts.length-1]
            if (ext.toUpperCase() ==="JPG" || ext.toUpperCase() === "JPEG") {
                eveluateImage(new_name)
           　}
        }
   })
}) //watcher.on('ready',function(){