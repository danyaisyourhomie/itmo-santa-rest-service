import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MAX_GIFTS_PER_REQUEST } from 'src/const/api';
import { ICommonGift } from 'src/items/interfaces/CommonGift';
import { NotificationService } from 'src/notifications/notifications.service';

@Injectable()
export class GiftsService {
  constructor(
    @InjectModel('Gift') private readonly giftModel: Model<ICommonGift>,
    private readonly notificationService: NotificationService,
  ) {}

  async createGift(gift: ICommonGift) {
    if (!gift.status) {
      gift.status = 'pending';
    }

    const lastGift = await this.giftModel
      .find()
      .limit(1)
      .sort({ $natural: -1 });

    let lastGiftCode = (lastGift as unknown as ICommonGift)[0]?.giftCode;

    if (!lastGiftCode) {
      lastGiftCode = 1000;
    }

    lastGiftCode = lastGiftCode + 1;

    const newGift = new this.giftModel({
      ...gift,
      giftCode: lastGiftCode,
    });

    this.handleGiftCreationNotification(newGift, 'RECEIVER_ATTACHED');

    return await newGift.save();
  }

  async getGifts(limit = MAX_GIFTS_PER_REQUEST, offset = 0) {
    const result = await this.giftModel
      .find()
      .select('status updatedAt giftCode -_id')
      .skip(Number(offset))
      .limit(Number(limit))
      .exec();

    return {
      users: result,
      count: await this.giftModel.countDocuments().exec(),
    };
  }

  async getGift(property: string, value: string) {
    if (property === 'id') {
      property = '_id';
    }

    const result = await this.giftModel.findOne({ [property]: value });

    if (!result) {
      throw new NotFoundException({ message: 'Подарок не найден' });
    }

    return result;
  }

  async updateGift(id: string, update): Promise<ICommonGift> {
    const result = await this.giftModel.findOneAndUpdate(
      { creatorId: id },
      update,
      {
        lean: true,
        new: true,
      },
    );

    if (!result) {
      throw new NotFoundException({ message: 'Подарок не найден' });
    }

    if (update.status && update.status === 'PENDING') {
      this.handleGiftCreationNotification(result, 'RECEIVER_ATTACHED');
    }

    if (update.status && update.status === 'DELIVERED') {
      this.handleGiftNotification(result, 'GIFT_DELIVERED');
    }

    if (update.status && update.status === 'RECEIVED') {
      this.handleGiftReceive(result);
    }

    return result;
  }

  async removeGift(id: string): Promise<ICommonGift> {
    const result = await this.giftModel.findOneAndDelete({ tg_id: id });

    if (!result) {
      throw new NotFoundException({ message: 'Подарок не найден' });
    }

    return result;
  }

  async handleGiftNotification(gift, event) {
    const notify = {
      receiverId: gift.receiverId,
      event,
    };
    const res = await this.notificationService.sendNotification(notify);
    return res;
  }

  async handleGiftCreationNotification(gift, event) {
    const notify = {
      receiverId: gift.receiverId,
      creatorId: gift.creatorId,
      event,
    };

    const res = await this.notificationService.sendPairNotification(notify);
    return res;
  }

  async handleGiftReceive(gift) {
    const notifyReceiver = {
      receiverId: gift.receiverId,
      event: 'GIFT_RECEIVED',
    };

    const notifyCreator = {
      receiverId: gift.creatorId,
      event: 'GIFT_WAS_TAKEN',
    };

    const resReceiver = await this.notificationService.sendNotification(
      notifyReceiver,
    );
    const resCreator = await this.notificationService.sendNotification(
      notifyCreator,
    );
    return [resReceiver, resCreator];
  }
}
