import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as request from 'request';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';
import { Mongo } from './db/mongo';
import { sysConf } from './config/sysConfig';
import { accountResult } from './accountResult';
import { googleOauth, google } from './googleOauth/googleOauth';

const app = express();
const mongo = new Mongo(sysConf.DB_URL);

app.get('/', (req, res) => {
    res.send('Server On.');
});

// Jwt가 유요한지 체크.
app.get('/account/check', (req, res) => {
    let { key }  = req.query;
    
    if(key === '' || key === null || key === undefined) {
        res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
        return false;
    }
    
    jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
        if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
        else {
            console.log(decode);
            res.json(new accountResult('토큰은 유효합니다.', true, key)); 
        }
    });
});

// Direct 로그인
app.get('/account/login/direct', (req, res) => {
    let { id, password } = req.query;

    let checkId = (value) => {
        return new Promise((respond, reject) => {
            if(value.toString() === '') {
                console.log('ERROR: 가입하지 않은 아이디로 로그인 시도 발생.');
                res.json(new accountResult('가입하지 않은 아이디입니다.', false, null));
            }
            else 
                respond(value);
        });
    }

    let checkPassword = (value) => {
        return new Promise((respond, reject) => {
            if(value[0]['password'] !== password) { 
                //value[0]['password']인 이유는 find로 찾아서 아마도 배열인가보다.
                //value['password']가 되려면, find()말고 findOne()같은걸 써야 하는 듯.
                console.log('ERROR: 비밀번호 틀린 사람 발생.');
                res.json(new accountResult('비밀번호가 틀립니다.', false, null));
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
                console.log('사용자에게 새로운 JWT 토큰 발행함. : key = '+token);
                res.json(new accountResult('로그인 성공', true, token));
            }
        );
    }

    let error = (err) => {
        res.json(new accountResult('로그인 실패.', false, null));
        console.log('main.ts: /account/login/direct: ', err);
    }
    
    mongo.getUser()['findOneByUserName'](id)
    .then(checkId)
    .then(checkPassword)
    .then(makingToken)
    .catch(error);
});

// Direct 가입
app.get('/account/sign/direct', (req, res) => {
    let { id, password, display_name } = req.query;
    
    if((id === '' || id === undefined) || 
    (password === '' || password === undefined) ||
    (display_name === '' || display_name === undefined)) {
        console.log('Somebody tried to sign without required info.');
        res.json(new accountResult('필수 정보가 누락되었습니다.', false, null));
        return ;
    }
    
    // 입력받은 id가 이미 가입되어있는 기록이 있는지 체크.
    let checkId = (value: mongoose.Document): Promise<mongoose.Document> => {
        return new Promise((respond, rej) => {
            if(value.toString() !== '') {
                console.log('I have this user info. : ' + value);
                res.json(new accountResult('이미 가입된 사용자 id입니다.', false, null));
                rej('Somebody has tried to sign with wrong account that we already have in DB.');
            }
            else {
                respond(value);
            }
        });
    }

    let sign = (value: mongoose.Document) => {
        value = new (mongo.getUser())();
        value['id'] = id;
        value['password'] = password;
        value['display_name'] = display_name;
        value['account_div'] = sysConf.ACCOUNT_DIV_DIRECT; 
        
        return value.save();
    }
    
    let returnResult = (value: mongoose.Document) => {
        return new Promise((respond, rej) => {
            console.log(`${value['id']} user has signed to our site now.`);
            res.json(new accountResult('Direct 회원 가입 성공.', true, null));
        });
    }
    
    mongo.getUser()['findOneByUserName'](id)
    .then(checkId)
    .then(sign)
    .then(returnResult)
    .catch(err => console.log(err));
});

// 구글 로그인
app.get('/account/login/google', (req, res) => {
    returnGoogleAddressForLoginAndSign(res);
});

// 구글 가입
app.get('/account/sign/google', (req, res) => {
    returnGoogleAddressForLoginAndSign(res);
});

app.get('/account/sign/google/redirect', (req, res) => {
    // TODO :: 여기서는 코드를 엑세스토큰으로 변경받고.
    // TODO :: 엑세스토큰으로 유저 정보를 일단 받아와서
    // TODO :: DB에 유저 정보가 있으면 정보 update하고 jwt토큰 생성 및 리턴.
    // TODO :: 없으면 모든 정보 insert하고 실패 정보 리턴. 
    console.log(req.query['code']);
    let code = req.query['code'];
    let _go = new googleOauth(
        sysConf.CLIENT_ID, 
        sysConf.CLIENT_SECRET, 
        sysConf.REDIRECT_URL_DECODE,
        sysConf.REDIRECT_URL_ENCODE);
    
    let checkType = (value: google) => {
        console.log('main.ts: /account/sign/google/redirect: accessToken is ' + value.getAccessToken());
        console.log('main.ts: /account/sign/google/redirect: refreshToken is ' + value.getRefreshToken());
        return _go.getUserProfile(value.getAccessToken());
    }

    let signOrLogin = (value) => {
        console.log('main.ts: /account/sign/google/redirect: user email address is ' + value['emailAddresses'][0]['value']);
        console.log('main.ts: /account/sign/google/redirect: user email address is ' + value['names'][0]['displayName']);

        // TODO :: 여기부터 시작하면 됨. 디비에서 유저 정보 읽어와서 가입인가 로그인인가 판단해야 해.

        res.json(value);
    }

    _go.getGoogleAccessToken(code)
    .then(checkType)
    .then(signOrLogin)
    .catch(err => console.log(err));
    //['names'][0]['metadata']['id']
    //res.send('is working.');
});

// 구글의 로그인과 가입의 절차가 같으므로 이렇게 처리.
function returnGoogleAddressForLoginAndSign(res) {
    let _go = new googleOauth(
        sysConf.CLIENT_ID, 
        sysConf.CLIENT_SECRET, 
        sysConf.REDIRECT_URL_DECODE,
        sysConf.REDIRECT_URL_ENCODE);
    
    res.json(_go.getGoogleOauthURL());
}

const httpServer = app.listen(sysConf.HTTP_SERVER_PORT, '', () => {
    console.log(`port: ${ httpServer.address().port }`);
});
