import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as request from 'request';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';
import { Mongo } from './db/mongo';
import { sysConf } from './config/sysConfig';
import { accountResult } from './accountResult';
import { googleOauth, google, googleProfile } from './googleOauth/googleOauth';

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
    // TODO :: 미가입자가 구글 로그인을 하게 되면 뭐가 날라오는지 확인 할 필요 있음.
    // TODO :: 처음가입자는 refreshToken을 받게 되는데, 혹시나 못 받게되면, 가입 못하게 할 필요 있음.
    //          심지어, 그 사용자는 우리앱이랑 연결이 되어 있으므로, 끊어 줄 필요도 있음.
    console.log(req.query['code']);
    let code = req.query['code'];
    let _go = new googleOauth(
        sysConf.CLIENT_ID, 
        sysConf.CLIENT_SECRET, 
        sysConf.REDIRECT_URL_DECODE,
        sysConf.REDIRECT_URL_ENCODE);

    let getUserProfile = (value: google): Promise<google> => {
        console.log('main.ts: /account/sign/google/redirect: accessToken is ' + value.getAccessToken());
        console.log('main.ts: /account/sign/google/redirect: refreshToken is ' + value.getRefreshToken());
        return new Promise((respond, rej) => {
            _go.getUserProfile(value.getAccessToken())
            .then((childValue: googleProfile) => {
                value.setUserProfile(childValue);
                respond(value);
            });
        });
    }
    
    let signOrLogin = (value: google) => {
        
        let userProfile: googleProfile = value.getUserProfile();
        let userEmail = userProfile.getEmailAddress();
        let userDisplayName = userProfile.getDisplayName();
        
        console.log('main.ts: /account/sign/google/redirect: user email address is ' + userEmail);
        console.log('main.ts: /account/sign/google/redirect: user display name is ' + userDisplayName);
        
        
        let hasUser = (childValue: mongoose.Document) => {
            if(childValue.toString() !== '') { // DB에 해당 유저 정보가 있다면..
                // 기존 유저가 존재하므로 로그인으로 처리
                login(value);
            } else {
                // 기존 유저가 존재하지 않으므로 가입으로 처리.
                sign(value);
            }
        }

        // 구글 이메일로 가입처리.
        let sign = (childValue: google) => {
            let userDoc: Promise<mongoose.Document>;
            userDoc = mongo.getUser()['insertGoogleUserSignInfo'](childValue);
            
            let finishSign = (finishValue) => {
                console.log(`main.ts: /account/sign/google/redirect: ${finishValue.toString()}`);
                res.json(new accountResult('가입 완료.', true, null));
            }

            userDoc.then(finishSign)
            .catch(err => console.log(err));
        }

        // 로그인 할 경우의 처리.
        let login = (childValue: google) => {
            // DB에 유저 정보가 있으면 정보 update하고 jwt토큰 생성 및 리턴.
            console.log('구글 로그인이다.');
            mongo.getUser()['updateGoogleUserInfo'](childValue)
            .then((updateResult) => { 
                if(updateResult['nModified'] != '1' || updateResult['ok'] != '1') {
                    res.json(new accountResult('로그인 실패. AccessToken 수정에 실패 함.', false, null));
                    return ;
                }
                
                jwt.sign(
                    {
                        Id: childValue.getUserProfile().getEmailAddress(),
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
            });
        }

        mongo.getUser().findOne({ id: userEmail }) //userEmail로 DB에 정보 검색. 기존 유저 존재하는지 판단 위함.
        .then(hasUser)
        .catch(err => console.log(err));
    }

    _go.getGoogleAccessToken(code)
    .then(getUserProfile)
    .then(signOrLogin)
    .catch(err => console.log(err));
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
