import * as mongoose from 'mongoose';
import { Mongo } from './mongo';

export class project {
    Schema: mongoose.Schema;

    constructor() {
        this.setSchema();
    }

    getModel(): mongoose.Model<mongoose.Document> {
        return mongoose.model('project', this.Schema);
    }

    setSchema() {
        this.Schema = new mongoose.Schema({
            //id: { type: String, required: true, unique: true, lowercase: true },
            writer_id: { type: String, required: true },
            number: { type: Number, required: true },
            title: { type: String }
        });

        this.Schema.statics['getProjectList'] = function (id: string): Promise<mongoose.Document> {
            return this['find']({ writer_id: id });
        }
    }
}