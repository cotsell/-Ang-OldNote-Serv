import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as request from 'request';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';
import { Mongo } from './db/mongo';
import * as cors from 'cors';
import { sysConf } from './config/sysConfig';
import { accountResult } from './accountResult';
import { googleOauth, google, googleProfile } from './googleOauth/googleOauth';
import { ISubject } from './Interface';

const app = express();
const mongo = new Mongo(sysConf.DB_URL);

app.use('/', express.static('client'));
// 바디파서 사용하기 위한 설정.
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(cors());

// 동일출처정책(CORS)를 해결하기 위해 해더에 다음과 같은 내용을 추가.
// 이 항목은 가능한 미들웨어 선언 이후에 위치하도록 하자.
// app.use((req, res, next) => {
// 	res.header('Access-Control-Allow-Origin', '*');
// 	res.header('Access-Control-Allow-Headers', 'X-Requested-With, Origin, Accept, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, Authorization');
// 	res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, OPTIONS, DELETE');
// 	next();
// });

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
				Id: value[0]['id']
			},
			sysConf.JWT_SECRET,
			{
				expiresIn: '1d',
				issuer: 'cotsell',
				subject: ''
			},
			(err, token) => {
				console.log('사용자에게 새로운 JWT 토큰 발행함. : key = '+token);
				res.json(new accountResult('로그인 성공', true, token, value[0]));
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
				login(childValue);
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
		let login = (childValue) => {
			// DB에 유저 정보가 있으면 정보 update하고 jwt토큰 생성 및 리턴.
			console.log('구글 로그인이다.');
			mongo.getUser()['updateGoogleUserInfo'](value)
			.then((updateResult) => { 
				if(updateResult['nModified'] != '1' || updateResult['ok'] != '1') {
						res.json(new accountResult('로그인 실패. AccessToken 수정에 실패 함.', false, null));
						return ;
				}
					
				jwt.sign(
					{
						Id: value.getUserProfile().getEmailAddress(),
					},
					sysConf.JWT_SECRET,
					{
						expiresIn: '1d',
						issuer: 'cotsell',
						subject: ''
					},
					(err, token) => {
						console.log('사용자에게 새로운 JWT 토큰 발행함. : key = '+token);
						res.redirect(sysConf.CLIENT_ADDRESS + '?key='+token + '&' +
													'id=' + childValue['id'] + '&' + 
													'display_name=' + childValue['display_name']);
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
	
	res.json({ result: _go.getGoogleOauthURL() });
}

// 클라이언트에게 요청받은 프로젝트 리스트를 리턴해줍니다.
app.get('/get/project_list', (req, res) => {
    let { key, id }  = req.query;
    
    if(key === '' || key === null || key === undefined) {
        res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
        return false;
    }

    if(id === '' || id === null || id === undefined) {
        res.json(new accountResult('ID가 전달되지 않았습니다.', false, null));
        return false;
    }
    
    jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
        if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
        else {
            // console.log(decode);
            loadProjectList()
            .then(value => {
                res.json(value); 
            });
        }
    });

    function loadProjectList(): Promise<mongoose.Document> {
        return mongo.getProject()['getProjectList'](id);
    }
    
});

app.get('/get/project', (req, res) => {
    let { key, project_id } = req.query;

    if(key === '' || key === null || key === undefined) {
        res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
        return false;
    }

    if(project_id === '' || project_id === null || project_id === undefined) {
        res.json(new accountResult('ID가 전달되지 않았습니다.', false, null));
        return false;
    }
    
    jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
        if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
        else {
            // console.log(decode);
            loadProject(project_id)
            .then(value => {
                res.json(value); 
            });
        }
    });    

    function loadProject(m_Project_id): Promise<mongoose.Document> {
        return mongo.getProject()['getProjectOne'](m_Project_id);
    }
});

// 프로젝트의 정보를 수정합니다.
app.put('/update/project', (req, res) => {
    let { key } = req.query;

    if(key === '' || key === null || key === undefined) {
        res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
        return false;
    }

    jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
        if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
        else {
            updateProject()
            .then(result => {
                // console.log(result);
                res.json(result);
            });
        }
    });

    function updateProject(): Promise<mongoose.Document> {
        return mongo.getProject()['updateProject'](req.body);
    }

});

// 서브젝트의 정보를 수정합니다.
app.put('/update/subject', (req, res) => {
    let { key } = req.query;

    if(key === '' || key === null || key === undefined) {
        res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
        return false;
    }

    jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
        if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
        else {
            updateSubject()
            .then(result => {
                // console.log(result);
                res.json(result);
            });
        }
    });

    function updateSubject() {
        console.log(req.body);
        return mongo.getSubject()['updateSubject'](req.body);
    }
});

// 클라이언트에게 요청받은 서브젝트 리스트를 리턴해줍니다.
// 각 서브젝트에 해당되는 아이템들도 같이 가져옵니다.
app.get('/get/subject_list', (req, res) => {
    let { key, id } = req.query;

    if(key === '' || key === null || key === undefined) {
        res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
        return false;
    }

    if(id === '' || id === null || id === undefined) {
        res.json(new accountResult('ID가 전달되지 않았습니다.', false, null));
        return false;
    }
    
    jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
        if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
        else {
            // console.log(decode);
            loadSubjectList()
            //.then(loadItemList);
            .then(value => {
              res.json(value);
            });
        }
    });

    function loadSubjectList(): Promise<mongoose.Document> {
        return mongo.getSubject()['getSubjectList'](id);
    }

    // 디비에서 가져온 서브젝트 리스트를 참고해서, 관련된 아이템들도 같이
    // 검색해서 합친 후 서브젝트와 아이템을 같이 클라이언트에게 전송.
    function loadItemList(value) {
			// console.log(value.length);
			let result = { subjects: value };
			let ids: any[] = [];

			for(let i = 0; i < value.length; i++) {
				ids.push(value[i]['_id']);
			}//console.log(ids);

			mongo.getItem()['getItemList'](ids)
			.then(finalValue => {
				result['items'] = finalValue;
				res.json(result);
			});
    }
});

// 클라이언트가 요청한 Item의 리스트를 돌려줍니다.
// 서브젝트들의 id가 필요해요. 한개를 요청하더라도 배열로 주세요.
app.get('/get/item_list', (req, res) => {
	console.log(`${JSON.stringify(req.query)}`);
    let { key, ids } = req.query;
    
    if(key === '' || key === null || key === undefined) {
      res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
      return false;
    }

    if(ids === '' || ids === null || ids === undefined) {
      res.json(new accountResult('ID가 전달되지 않았습니다.', false, null));
      return false;
    }
    
    jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
      if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
      else {
        // console.log(decode);
        getItemList()
        .then(value => {
          res.json(value);
        });
      }
    });

    function getItemList() {
      let subjectIds: string[];
    	subjectIds = ids.split(',');
      return mongo.getItem()['getItemList'](subjectIds);
    }
});

// 클라이언트가 요청한 Item의 정보를 수정합니다.
// 수정 후 결과는 상태와 더불어 바뀐 내용을 같이 보냅니다.
// 변경 항목 중 '_id'는 필수 항목이에요.
app.put('/update/item', (req, res) => {
    // let temp: any = JSON.stringify(req.body).split(',');
    // temp.shift();
    // temp = Object.assign({}, { $set: temp });
    console.log(`/update/item 으로 요청이 왔어요. : ${ JSON.stringify(req.body) }`);
    // console.log(temp);
    mongo.getItem()['updateItem'](req.body, (err, raw) => {
        res.json(raw);
    });
});

app.get('/get/item', (req, res) => {
  let { key, item_id } = req.query;

  if(key === '' || key === null || key === undefined) {
    res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
    return false;
  }

  if(item_id === '' || item_id === null || item_id === undefined) {
    res.json(new accountResult('ID가 전달되지 않았습니다.', false, null));
    return false;
  }
  
  jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
    if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
    else {
      loadItem()
      .then(result => { 
        // console.log(result);
        res.json(result); 
      });
    }
  });

  function loadItem() {
    return mongo.getItem()['getItem'](item_id);
  }
});

app.get('/get/tags', (req, res) => {
  let { key, writer_id } = req.query;

  if(key === '' || key === null || key === undefined) {
    res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
    return false;
  }

  jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
    if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
    else {
      loadTags()
      .then(result => { 
        console.log(result);
        res.json(result); 
      });
    }
  });

  function loadTags() {
    return mongo.getTag()['getTags'](writer_id);
  }
});

app.post('/insert/item', (req, res) => {
  let { key } = req.query;

  if(key === '' || key === null || key === undefined) {
    res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
    return false;
  }

  jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
    if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
    else {
      insertItem()
      .then(result => { 
        console.log(result);
        res.json(result); 
      });
    }
  });

  function insertItem() {
    return mongo.getItem()['insertItem'](req.body);
  }
});

app.post('/insert/fast', (req, res) => {
  let { key } = req.query;
  if(key === '' || key === null || key === undefined) {
    res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
    return false;
  }

  jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
    if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
    else {
      insertFast()
      .then(result => { 
        console.log(result);
        res.json(result); 
      });
    }
  });

  function insertFast() {
    return mongo.getFast()['insertFast'](req.body);
  }
});

app.post('/insert/project', (req, res) => {
  let { key } = req.query;

  if(key === '' || key === null || key === undefined) {
    res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
    return false;
  }

  jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
    if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
    else {
      insertProject()
      .then(result => { 
        console.log(result);
        res.json(result); 
      });
    }
  });

  function insertProject(): Promise<mongoose.Document> {
    console.log(JSON.stringify(req.body));
    return mongo.getProject()['insertProject'](req.body);
  }
});

app.post('/insert/subject', (req, res) => {
    let { key } = req.query;

    if(key === '' || key === null || key === undefined) {
        res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
        return false;
    }

    jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
        if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
        else {
            insertSubject()
            .then(result => { 
                console.log(result);
                res.json(result); 
            });
        }
    });

    function insertSubject(): Promise<mongoose.Document> {
        return mongo.getSubject()['insertSubject'](req.body);
    }
});

app.delete('/delete/project', (req, res) => {
  let { key, _id } = req.query;
  let projectResult;

  if(key === '' || key === null || key === undefined) {
    res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
    return false;
  }

  jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
    if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
    else {
      deleteProject()
      .then(findSubject)
      .then(deleteSubject)
      .then(deleteItem)
      .then(result => { 
        console.log(result);
        
        res.json({ project: result.project, subject: result.subject, item: result.item }); 
      });
    }
  });

  interface ProjectDeletedResult {
    project?: any;
    subject?: any;
    item?: any;
    subjectList?: any;
  }
  
  function deleteProject(): Promise<mongoose.Document> {
    return mongo.getProject()['deleteProject'](_id);
  }

  function findSubject(ProjectResult): Promise<ProjectDeletedResult> {
    return new Promise<ProjectDeletedResult>((resolve, reject) => {
      mongo.getSubject()['getSubjectList'](_id)
      .then(subjectList => {
        resolve({ project: ProjectResult, subjectList: subjectList });
      });
    });
  }

  function deleteSubject(result): Promise<ProjectDeletedResult> {
    return new Promise<ProjectDeletedResult>((resolve, reject) => {
      mongo.getSubject()['deleteSubjectWithProjectId'](_id)
      .then(childResult => { 
        // console.log(`deleteSubject(): childResult ${ JSON.stringify(childResult) }`);
        // console.log(`deleteSubject(): result: ${ JSON.stringify(result) }`);
        resolve(Object.assign({}, result, { subject: childResult }));
        });
    });
  }

  function deleteItem(result): Promise<ProjectDeletedResult> {
    let subjectIds: string[];
    subjectIds = organize(result['subjectList']);
    return new Promise<ProjectDeletedResult>((resolve, reject) => {
      mongo.getItem()['deleteItemsWithSubjectId'](subjectIds)
      .then(childResult => {
        // console.log(`deleteItem(): childResult ${ JSON.stringify(childResult) }`);
        // console.log(`deleteItem(): result: ${ JSON.stringify(result) }`);
        resolve(Object.assign({}, result, { item: childResult }));
      });
    });
  }

  function organize(result: ISubject[]): string[] {
    let resultArray = [];
    for (let i = 0; i < result.length; i++) {
      resultArray.push(result[i]._id);
    }
    return resultArray;
  }
})

// 서브젝트를 지워줘요.
// 서브젝트의 _id가 필요합니다.
app.delete('/delete/subject', (req, res) => {
  let { key, _id } = req.query;

  if(key === '' || key === null || key === undefined) {
    res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
    return false;
  }

  jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
    if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
    else {
      // console.log('TTTTT' + _id);
      deleteSubject()
      .then(deleteItem)
      .then(result => { 
        console.log(result);
        res.json(result); 
      });
    }
  });

  function deleteSubject() {
    return mongo.getSubject()['deleteSubject'](_id);
  }

  function deleteItem(subjectResult) {
    return new Promise<any>((resolve, reject) => {
      const subjectId = [];
      subjectId.push(_id)
      // 여기서는 SubjectId가 한개이지만, deleteItems()는 배열을 요구해요.
      mongo.getItem()['deleteItemsWithSubjectId'](subjectId)
      .then(itemResult => { resolve({ subject: subjectResult, item: itemResult }) });
    });
  }
});

// Item을 하나 지워줘요.
// Item의 _id가 하나 필요합니다.
app.delete('/delete/item', (req, res) => {
  let { key, _id } = req.query;

  if(key === '' || key === null || key === undefined) {
    res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
    return false;
  }

  jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
    if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
    else {
      console.log(`main.ts: delete/item: A id that Server received from client is ${ _id }`);
      deleteItem()
      .then(result => { 
        console.log(result);
        res.json(result); 
      });
    }
  });

  function deleteItem() {
    // return mongo.getItem()['deleteItem'](_id);
    return mongo.getItem()['findAndModify'](_id);
  }
});

app.delete('/delete/fast', (req, res) => {
  let { key, _id } = req.query;

  if(key === '' || key === null || key === undefined) {
    res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
    return false;
  }

  jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
    if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
    else {
      console.log(`main.ts: delete/fast: A id that Server received from client is ${ _id }`);
      deleteFast()
      .then(result => { 
        console.log(result);
        res.json(result); 
      });
    }
  });

  function deleteFast() {
    return mongo.getFast()['deleteFast'](_id);
  }
});

// Fast 단일항목 혹은 여러항목을 가져다 줘요.
// 사용자는 3가지 방법으로 항목들을 가져올 수 있어요.
// 1. fast의 _id들을 담고 있는 _ids 배열을 사용.
// 2. project_id를 사용.
// 3. project_id와 tag들을 담고 있는, tags를 같이 사용.
app.get('/get/fast', (req, res) => {
  let { key, _ids, project_id, tags } = req.query;

  if(key === '' || key === null || key === undefined) {
    res.json(new accountResult('Key가 전달되지 않았습니다.', false, null));
    return false;
  }

  jwt.verify(key, sysConf.JWT_SECRET, (err, decode) => {
    if(err) res.json(new accountResult('Key에 문제가 있습니다.', false, null));
    else {
      console.log(`main.ts: get/fast: _ids is ${ _ids }`);
      console.log(`main.ts: get/fast: project_id is ${ project_id }`);
      console.log(`main.ts: get/fast: tags is ${ tags }`);
      getFast()
      .then(result => 
        { 
          console.log(result);
          res.json(result); 
        }
      );
    }
  });

  function getFast() {
    if (_ids !== undefined && _ids !== null) {
      _ids = _ids.split(',');
      return mongo.getFast()['getFast'](undefined, _ids, undefined);
    } else {
      if (project_id !== undefined && project_id !== null) {
        if (tags !== undefined && tags !== null && tags.length > 0) {
          tags = tags.split(',');
          return mongo.getFast()['getFast'](project_id, undefined, tags);
        } else {
          return mongo.getFast()['getFast'](project_id, undefined, undefined);
        }
      }
    }
  }
});

const httpServer = app.listen(sysConf.HTTP_SERVER_PORT, '', () => {
  console.log(`port: ${ httpServer.address().port }`);
});
