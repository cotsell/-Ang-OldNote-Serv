import * as mongoose from 'mongoose';
import { google } from '../googleOauth/googleOauth';
import { sysConf } from '../config/sysConfig';

// 여러군데의 DB에 접속할 경우가 발생할 수 있으므로,
// 싱글턴으로 가지는 않기로 함.
export class Mongo {
    db: mongoose.Connection;
    userSchema: mongoose.Schema;
        
    constructor(url: string) {
        this.setConnectMongoDB(url);
        mongoose.connection.on('disconnected', this.setConnectMongoDB);
        this.setUser();
    }

    // DB에 접속.
    setConnectMongoDB(url: string) {
        // mongoose.Promise = global.Promise;
        this.db = mongoose.connection;
        this.db.on('error', console.error);
        this.db.once('open', () => { console.log('Connected to mongoDB.') });
        mongoose.connect(url);
    }

    setUser() {
        this.userSchema = new mongoose.Schema({
                id: { type: String, required: true, unique: true, lowercase: true },
                password: { type: String, lowercase: true },
                display_name: { type: String, required: true },
                account_div: { type: Number, required: true },
                access_token: { type: String },
                refresh_token: { type: String }
            }
        );

        this.userSchema.statics['findOneByUserName'] = function(userId: string): Promise<mongoose.Document> {
            return this['find']({ id: userId });
        }

        this.userSchema.statics['insertGoogleUserSignInfo'] = function(google: google): Promise<mongoose.Document> {
            let emailAddress = google.getUserProfile().getEmailAddress();
            let displayName = google.getUserProfile().getDisplayName();
            let accessToken = google.getAccessToken();
            let refreshToken = google.getRefreshToken() || ''; // TODO :: 일단은 이렇게 처리했지만.. 수정 필요.
            let myDoc: mongoose.Document = new this(
                {
                    id: emailAddress,
                    display_name: displayName,
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    account_div: sysConf.ACCOUNT_DIV_GOOGLE
                });

            return myDoc.save();
        }

        this.userSchema.statics['updateGoogleUserInfo'] = function(google: google): Promise<any> {
            return new Promise((respond, rej) => {
                this['update'](
                    { id: google.getUserProfile().getEmailAddress() },
                    { $set: { access_token: google.getAccessToken() } },
                    (err, raw) => {
                        respond(raw);
                    }
                );
                
                // 위는 모델에서 수정한거고, 아래는 다큐먼트에서 수정한건데..
                // 아래는 작동 안하고 있다. 사용법 찾아보고 수정해보자.
                // this['findOne'](google.getUserProfile().getEmailAddress())
                // .then((userDoc: mongoose.Document) => {
                //     userDoc.update({$set: { access_token: google.getAccessToken() }},
                //     {},
                //     (err, raw) => {
                //         respond(raw);
                //     });
                // });
            });
        }
    }

    getUser(): mongoose.Model<mongoose.Document> {
        return mongoose.model('user', this.userSchema);
    }
}