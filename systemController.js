const fs = require("fs");
const path = require("path");
const log4js = require('log4js');
const { time } = require("console");
log4js.configure("log-config.json");
const eventLogger = log4js.getLogger('event');

exports.check_dir = (dir) => {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdir(dir, { recursive: true }, (err) => {
                if (err) {
                    eventLogger.error(err);
                    //throw err;
                }
            });
            console.log(`created ${dir}.`)
        }
    } catch {
        eventLogger.error(`フォルダ[ ${dir} ] は作れませんでした。`)
    }
}
exports.read_day_text = (file) => {
    let data="";
    try {
        data = fs.readFileSync(file, 'utf-8');
    } catch {
        data = null;
    }
    return data;
}
exports.clear_folder = (dir) => {
    const files = fs.readdirSync(dir);
    console.log(files)

    files.forEach(file => {
        // fs.unlink( dir + "/" + file, (err => {
        //     if (err) console.log(err);
        //     else {
        //       console.log(`${dir}内の${file}を削除しました。`);
        //     }
        // }));
        this.remove_file(dir + "/" + file);
    });
}
exports.remove_file = (file) => {
    if ( fs.existsSync(file) ) {
        fs.unlink( file, (err => {
            if (err) console.log(err);
            else {
              console.log(`${file}を削除しました。`);
            }
        }));
    }
}