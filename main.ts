import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as request from 'request';
import * as jwt from 'jsonwebtoken';
import { Mongo } from './db/mongo';
import { sysConf } from './config/sysConfig';
import { loginStatus } from './loginStatus';

const app = express();
const mongo = new Mongo(sysConf.DB_URL);

app.get('/', (req, res) => {
    res.send('Server On.');
});

// Jwt로 로그인
app.get('/account/login', (req, res) => {
    let { key }  = req.query;
    
    if(key === '' || key === null || key === undefined) {
        res.json(new loginStatus('Key가 전달되지 않았습니다.', false, null));
        return false;
    }
    
    jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
        if(err) res.json(new loginStatus('Key에 문제가 있습니다.', false, null));
        else {
            console.log(decode);
            res.json(new loginStatus('로그인 성공', true, key)); 
        }
    });
});

// Direct 로그인
app.get('/account/login/direct', (req, res) => {
    let { id, password } = req.query;
    // console.log(`id: ${id}, password:  ${password}`);

    let checkId = (value) => {
        return new Promise((respond, reject) => {
            if(value.toString() === '') {
                console.log('ERROR!!!!!');
                res.json(new loginStatus('가입하지 않은 아이디입니다.', false, null));
            }
            else 
                respond(value);
        });
    }

    let checkPassword = (value) => {
        return new Promise((respond, reject) => {
            if(value[0]['password'] !== password) {
                console.log('ERROR!!');
                res.json(new loginStatus('비밀번호가 틀립니다.', false, null));
            }
            else
                respond(value);
        });
    }

    let makingToken = (value) => {
        jwt.sign(
            {
                Id: value[0]['id'],
            },
            sysConf.JWT_SECRET,
            {
                expiresIn: '1d',
                issuer: 'cotsell',
                subject: ''
            },
            (err, token) => {
                res.json(new loginStatus('로그인 성공', true, token));
            }
        );
    }

    let error = (err) => {
        res.json(new loginStatus('로그인 실패.', false, null));
        console.log('main.ts: /account/login/direct: ', err);
    }
    
    mongo.getUser()['findOneByUserName'](id)
    .then(checkId)
    .then(checkPassword)
    .then(makingToken)
    .catch(error);
});

// 구글 로그인
app.get('/account/login/google', (req, res) => {
    res.send('is working.');
});

// Direct 가입
app.get('/account/sign/direct', (req, res) => {
    res.send('is working.');
});

// 구글 가입
app.get('/account/sign/google', (req, res) => {
    res.send('is working.');
});

app.get('/account/sign/google/redirect', (req, res) => {
    res.send('is working.');
});

const httpServer = app.listen(sysConf.HTTP_SERVER_PORT, '', () => {
    console.log(`port: ${ httpServer.address().port }`);
});