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
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
})

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

// readImageFromFileToBuffer : Promise を返す
const readImageFromFileToBuffer = ( file )=> {
    const image = sharp(file)
    return new Promise( (resolve, reject)=> {
        image
        .metadata().then(function(metadata) {
            // width = Math.round(metadata.width/2);
            // height = metadata.height;
            // offset_x = Math.round( width/2 );
            // offset_y = 0;  
            return image
            .blur()
            // .extract({ left: offset_x, top: offset_y, width: width, height: height })
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
const resizeImageFromFileToFile = ( fileName, bbox )=> {
    const image = sharp(`${watch_dir}/${fileName}`)
    return new Promise( (resolve, reject)=> {
        image
        .metadata().then(function(metadata) {
            const 
                offset_x = Math.round( bbox.x * metadata.width/testWidth ),
                right_x = Math.round( (testWidth - bbox.x - bbox.width ) * metadata.width/testWidth ),
                offset_y = Math.round( bbox.y * metadata.width/testHeight ),
                bottom_y = Math.round( (testHeight - bbox.y - bbox.height ) * metadata.height/testHeight ),
                width = Math.round((metadata.width - right_x - offset_x) ),
                height = Math.round((metadata.height - bottom_y - offset_y) )
                console.log(`metadata.width: ${metadata.width}, metadata.height: ${metadata.height}`)
                console.log(`offset_x: ${offset_x}, offset_y: ${offset_y}, width: ${width}, height: ${height}`)
                console.log(`right_x: ${right_x}, bottom_y: ${bottom_y}, width: ${width}, height: ${height}`)
                return image
                        .extract({ left: offset_x, top: offset_y, width: width, height: height })
                        .resize(finalWidth)
                        .jpeg()
                        .toFile(`${resized_dir}/resized_${fileName}`)
                        // .toBuffer()
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

// boundingBox : Bounding Box を返す
const boundingBox = ( back, front ) => {
    return new Promise( resolve => {
        const difBufferR=[],
              difBufferG=[],
              difBufferB=[]
        let index=0
        while(index<front.length) {
            const dif = Math.abs(back[index]-front[index])
            if( index % 3 === 0 ) {
                difBufferR.push(dif)
            } else if( index % 3 === 1 ) {
                difBufferG.push(dif)
            } else {
                difBufferB.push(dif)
            }
            index++
        }
        const r_max = difBufferR.reduce((a,b)=>a>b?a:b),
              r_min = difBufferR.reduce((a,b)=>a<b?a:b),
              g_max = difBufferG.reduce((a,b)=>a>b?a:b),
              g_min = difBufferR.reduce((a,b)=>a<b?a:b),
              b_max = difBufferB.reduce((a,b)=>a>b?a:b),
              b_min = difBufferB.reduce((a,b)=>a<b?a:b)
        const normalizedRThreashold = (r_max+r_min)/4,
              normalizedGThreashold = (g_max+g_min)/4,
              normalizedBThreashold = (b_max+b_min)/4
        let x_max=0, y_max=0, x_min=testWidth, y_min=testHeight
        console.log(`r_max:${r_max}, r_min:${r_min}, normalizedRThreashold:${normalizedRThreashold}`)
        console.log(`g_max:${g_max}, g_min:${g_min}, normalizedGThreashold:${normalizedGThreashold}`)
        console.log(`b_max:${b_max}, b_min:${b_min}, normalizedBThreashold:${normalizedBThreashold}`)
        for (let i=0; i<testHeight; i++) {
            for ( let j=0; j<testWidth; j++) {
                index = testWidth*i + j
                const r_value = difBufferR[index],
                      g_value = difBufferG[index],
                      b_value = difBufferB[index]
                const x_pos = index % testWidth,
                      y_pos = Math.floor(index / testWidth)

                if( r_value>normalizedRThreashold 
                    || g_value>normalizedGThreashold 
                    || r_value>normalizedBThreashold) {
                        x_max = ( (x_pos > x_max) ? x_pos: x_max )
                        x_min = ( (x_pos < x_min) ? x_pos: x_min )
                        y_max = ( (y_pos > y_max) ? y_pos: y_max )
                        y_min = ( (y_pos < y_min) ? y_pos: y_min )
                    }                
            }
        }
        const bbox = {x:x_min, y: y_min, width: x_max-x_min, height: y_max - y_min}
        console.log(`{x:${x_min}, y: ${y_min}, width: ${x_max-x_min}, height: ${y_max - y_min}}`)
        resolve(bbox)
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

let bgImageData
readImageFromFileToBuffer('./images/bg.jpg')
.then((data) => {
    bgImageData = data
})
.then(() => {
    console.log(`bgImageData[[${bgImageData.length}]]`)
})

async function eveluateImage(fileName) {
    const newImageData = await readImageFromFileToBuffer(`${watch_dir}/${fileName}`)
    const bbox = await boundingBox(bgImageData,newImageData)
    console.log(`bbox.x: ${bbox.x}, bbox.y: ${bbox.y}, bbox.width: ${bbox.width}, bbox.height: ${bbox.height}`)
    await resizeImageFromFileToFile(fileName, bbox )
    await keepOriginal(fileName)
    await removeFile(`${watch_dir}/${fileName}`)
}


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

    readline.on('line', function(line){
        const cmd = line.toUpperCase();

        if ( cmd === "" ) {
            console.log("コマンドリスト\n");
            console.log("    Q: 終了\n");
            console.log("    C: 終了をキャンセル\n");

        } else if ( cmd === "Q" ) {
            // console.log("10秒後に終了します");
            // timer = setTimeout( () => {
            //     process.exit();
            // }, 10000);
            process.exit();


        } else if ( cmd === "C") {
            if (timer) {
                new Promise(()=> {
                    console.log("終了をキャンセルします");
                    clearTimeout(timer); 
                    timer = null;
                })
            }
        } 
    })
    
}) //watcher.on('ready',function(){