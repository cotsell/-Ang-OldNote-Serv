import * as mongoose from 'mongoose';

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
                password: { type: String, required: true, lowercase: true },
                account_div: { type: Number, required: true }
            }
        );

        this.userSchema.statics['findOneByUserName'] = function(userId: string): Promise<mongoose.Document> {
            return this['find']({ id: userId });
        }

        this.userSchema.statics['insertUserSignInfo'] = function(id: string, password: string): Promise<mongoose.Document> {
            return this['insert']({ id: id, password: password });
        }
    }

    getUser(): mongoose.Model<mongoose.Document> {
        return mongoose.model('user', this.userSchema);
    }
}