import * as mongoose from 'mongoose';
import { Mongo } from './mongo';

export class tag {
    Schema: mongoose.Schema;

    constructor() {
        this.setSchema();
    }

    getModel(): mongoose.Model<mongoose.Document> {
        return mongoose.model('tag', this.Schema);
    }

    setSchema() {
        this.Schema = new mongoose.Schema({
            writer_id: { type: String, required: true },
            title: { type: String, required: true },
            number: { type: Number, required: true }
        });

        this.Schema.statics['getTags'] = function (writer_id: String) {
            return this['find']({ writer_id: writer_id });
        }
    }
}