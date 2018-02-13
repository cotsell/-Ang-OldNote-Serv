import * as mongoose from 'mongoose';
import { Mongo } from './mongo';
import { ISubject } from '../Interface';

export class subject {
  Schema: mongoose.Schema;

  constructor() {
    this.setSchema();
  }

  getModel(): mongoose.Model<mongoose.Document> {
    return mongoose.model('subject', this.Schema);
  }

  setSchema() {
    this.Schema = new mongoose.Schema({
      writer_id: { type: String, required: true}, //, unique: true, lowercase: true },
      project_id: { type: String, required: true },
      number: { type: Number, required: true },
      title: { type: String },
      deleted: { type: Boolean, required: true }
    });

    this.Schema.statics['getSubjectList'] = function (projectId: string): Promise<mongoose.Document> {
      // return this['find']({ $and: [{ project_id: projectId }, { deleted: false }] });
      return this['find']({ project_id: projectId, deleted: false });
    }

    // Subject 단일 항목을 수정합니다.
    // _id는 필수이며, 나머지 항목에 대해서는 수정하고자 하는 항목만
    // 넣어주면 됩니다.
    // ex) {_id: '3434324234', title: '변경할 멘트'}
    this.Schema.statics['updateSubject'] = function(json) {
      const titleName = ['writer_id', 'project_id', 'number', 'title'];
      let conditions: any = {};
      for (let i = 0; i < titleName.length; i++) {
        if (json[titleName[i]] !== null && json[titleName[i]] !== undefined) {
          conditions[titleName[i]] = json[titleName[i]];
        }
      }
      conditions = { $set: conditions };
      return this['update']({_id: json['_id']}, conditions);
    }

    // 서브젝트를 새로 입력해요. 서브젝트 객체 하나가 필요해요.
    this.Schema.statics['insertSubject'] = function(subject:ISubject): Promise<mongoose.Document> {
      let doc:mongoose.Document = new this();
      doc['deleted'] = false;
      doc['number'] = 1;
      doc['project_id'] = subject.project_id;
      doc['writer_id'] = subject.writer_id;
      doc['title'] = subject.title;
      return doc.save();
    }

    // 서브젝트의 상태를 deleted상태로 바꿔줘요.
    // ProjectId 한개가 필요해요.
    this.Schema.statics['deleteSubjectWithProjectId'] = function(ProjectId: string): Promise<mongoose.Document> {
      return this['update']({ project_id: ProjectId }, { $set: { deleted: true } }, { multi: true });
    }

    // findByIdAndUpdate()로 처리 변경. 주석으로만 남겨둘께요.
    // 서브젝트의 상태를 deleted상태로 바꿔줘요.
    // SubjectId 한개가 필요해요.
    // this.Schema.statics['OldVerDeleteSubject'] = function(subjectId: string): Promise<mongoose.Document> {
    //     return this['update']({ _id: subjectId }, { $set: { deleted: true } }, { multi: true });
    // }

    // 위의 OldVerDeleteSubject()과 같은 기능을 하는데, 결과물이 다르다.
    // 새로 수정된 문서를 결과로 돌려줍니다.
    this.Schema.statics['deleteSubject'] = function(subjectId: string): Promise<mongoose.Document> {
      return this['findByIdAndUpdate']({ _id: subjectId },
                                        { $set: { deleted: true } },
                                        { new: true });
    }
  }
}