import * as mongoose from 'mongoose';
import { IItem } from '../Interface';

export class fast {
    Schema: mongoose.Schema;

    constructor() {
        this.setSchema();
    }

    getModel(): mongoose.Model<mongoose.Document> {
        return mongoose.model('fast', this.Schema);
    }

    setSchema() {
        this.Schema = new mongoose.Schema(
            {
                writer_id: { type: String, required: true },
                project_id: { type: String, required: true },
                title: { type: String, required: true },
                text: { type: String },
                tags: { type: [String] },
                number: { type: Number, required: true },
                deleted: { type: Boolean, required: true }
            }
        );

        // Fast를 가져옵니다. 단일 항목을 가져오려면 배열에 id를 한개만 넣어줘요.
        this.Schema.statics['getFast'] = function (project_id?: string, ids?: string[], tags?: string[]): Promise<mongoose.Document> {
            let conditions = {};
            // ids에 값이 있는 경우는 id로만 검색하는 경우에요.
            if (ids !== undefined && ids !== null && ids.length > 0) {
                // conditions = { $or: [] };
                let idsArray = [];
                for (let i = 0; i < ids.length; i++) {
                    idsArray.push({ _id: ids[i], deleted: false });
                    // conditions['$or'].push({ _id: ids[i], deleted: false });
                }
                conditions = { $or: idsArray };
            } else { // project_id만 있거나, project_id와 tags가 있는 경우.
                console.log();
                if (project_id !== undefined && project_id !== null) {
                    let test = [];
                    test.push({ project_id: project_id });
                    test.push({ deleted: false });
                    if (tags !== undefined && tags !== null && tags.length > 0) {
                        let test2 = [];
                        for (let i = 0; i < tags.length; i++) {
                            test2.push({ tags: tags[i] });
                        }
                        test.push({ $or: test2 });
                    }
                    conditions = { $and: test };
                }
            }
            console.log(`fast.ts: getFast(): 완성된 조건식은`, JSON.stringify(conditions));
            return this['find'](conditions);
        }

        this.Schema.statics['insertFast'] = function (json: IItem): Promise<mongoose.Document> {
            console.log(`fast.ts: insertFast(): Init.`);
            console.log(json);
            let doc: mongoose.Document = new this;
            doc['tags'] = json.tags;
            doc['deleted'] = false;
            doc['number'] = 1;
            doc['project_id'] = json.project_id;
            doc['writer_id'] = json.writer_id;
            doc['text'] = json.text ? json.text : '';
            doc['title'] = json.title ? json.title : 'Imsi';
            return doc.save();
        }

        this.Schema.statics['deleteFast'] = function (fastId: string): Promise<mongoose.Document> {
            return this['update']({ _id: fastId }, { $set: { deleted: true } });
        }
    }
}