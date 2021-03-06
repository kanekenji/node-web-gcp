// 環境変数GAE_APPLICATIONの有無でApp Engineで動作しているかを判断
// ローカル環境の場合はサービスアカウントの秘密鍵を設定する
// gcloud app deploy,gcloud app browse, gcloud auth revoke
if (!process.env.GAE_APPLICATION) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 
    '*************';
}

// バケット名を指定
const bucketName = '*******';

const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('uuid');
const moment = require('moment');
	
const {Datastore} = require('@google-cloud/datastore');
const {Storage} = require('@google-cloud/storage');

const app = express();
app.use(bodyParser.::({ extended: false }));
app.set('view engine', 'ejs');
app.set('views', './views');

const storage = new Storage();
const bucket = storage.bucket(bucketName);

const datastore = new Datastore();

// 投書一覧の表示
app.get('/', async function(req, res) {
    try {
        // Datastoreから投書一覧を取得
        const query = datastore.createQuery('letter');
        // 投稿日時で並び替え（新しいもの順）
        query.order('time', { descending: true });

        // 取得したデータをテンプレートで表示する形式に変換
        const response = await query.run();
        const entities = response[0];
        const letters = entities.map(function(entity) {
            return {
                id: entity[datastore.KEY].path[1],
                time: moment(entity.time),
                name: entity.name,
                mainCategory: entity.mainCategory,
                excerpt: entity.excerpt
            };
        });
        const vars = {
            letters: letters
        };
        res.render('index', vars);
    } catch (err) {
        console.log(err);

        // ブラウザがエラーにならないように空状態で表示する
        const vars = {
            letters: []
        };
        res.render('index', vars);
    }
});

// 個別の投書の表示
app.get('/letter/:id', async function(req, res) {
    // 表示する投稿のIDを取得（IDはURLから取得する）
    const id = req.params.id;

    try {
        // 2つのサービスを呼び出すのでletで定義
        let response;

        // Datastoreから投書情報を取得
        const key = datastore.key(['letter', id]);
        response = await datastore.get(key);
        const entity = response[0];

        // GCSバケットに保存されている投書本体を取得
        const file = bucket.file(id + '.txt');
        response = await file.download();
        const content = response[0];

        // 取得したデータをテンプレートで表示する形式に変換
        const letter = {
            time: moment(entity.time),
            name: entity.name,
            mail: entity.mail,
            categories: entity.categories,
            content: content.toString()
        }

        const vars = {
            letter: letter
        };
        res.render('show', vars);
    } catch (err) {
        console.log(err);

        res.redirect('/');
    }
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
