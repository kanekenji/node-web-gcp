// 秘密鍵ファイルを指定
process.env.GOOGLE_APPLICATION_CREDENTIALS = 
'./win-prote-09d8b7a59f1a.json';

// バケット名を指定
const bucketName = 'win-prote';

const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('uuid');
const moment = require('moment');
	
const {Datastore} = require('@google-cloud/datastore');
const {Storage} = require('@google-cloud/storage');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'ejs');
app.set('views', './views');

const storage = new Storage();
const bucket = storage.bucket(bucketName);

const datastore = new Datastore();

// 一覧表示を作るまでの仮実装
app.get('/', function(req, res) {
    res.send('Hello');
});

// 投稿ページの表示
app.get('/post', function(req, res) {
    res.render('post');
});

// 投稿の処理
app.post('/post', async function(req, res) {
    // 投稿データを取得（投稿日時は現在の時刻）
    const time = new Date();
    const name = req.body.name;
    const mail = req.body.mail;
    const content = req.body.content;

    try {
        // 一行目を概要とする（一行目が長い場合は省略）
        let excerpt = content.split('\n')[0];
        if (excerpt.length > 33) {
            excerpt = excerpt.substr(0, 30) + '...';
        }

        // IDを生成する
        const id = uuid.v4();

        // 投稿情報をDatastoreに格納
        const key = datastore.key(['letter', id]);
        const data = {
            time: time,
            name: name,
            mail: mail,
            excerpt: excerpt,
            // カテゴリー情報は仮の値を設定しておく
            mainCategory: '*カテゴリー解析中*',
            categories: [{name: '*解析中*'}]
        };
        await datastore.save({key: key, data: data});

        // 投稿内容をバケットに書き込む
        // アップロードをトリガーにCloud Functionsが実行される
        const file = bucket.file(id + '.txt');
        await file.save(content);
    } catch (err) {
        console.log(err);
    }

    res.redirect('/');
});
	
// サーバの起動（App Engineでは環境変数PORTに待機すべきポート番号が設定される）
app.listen(process.env.PORT || 8080, function() {
    console.log('server started');
});	