import { EmailLabel } from '../models/EmailLabel.js';
import { EmailLabelAssignment } from '../models/EmailLabelAssignment.js';

export interface CreateLabelData {
  name: string;
  color: string;
}

export class LabelService {
  /**
   * Get all labels for a user
   */
  static async getLabels(userId: string): Promise<any[]> {
    const labels = await EmailLabel.find({ userId })
      .sort({ name: 1 });

    // Get email counts for each label
    const labelStats = await EmailLabelAssignment.aggregate([
      {
        $lookup: {
          from: 'emailmetadatas',
          localField: 'emailId',
          foreignField: '_id',
          as: 'email'
        }
      },
      {
        $match: {
          'email.recipientIds': userId
        }
      },
      {
        $group: {
          _id: '$labelId',
          emailCount: { $sum: 1 }
        }
      }
    ]);

    const statsMap = new Map(
      labelStats.map((stat: any) => [stat._id.toString(), stat.emailCount])
    );

    return labels.map((label: any) => ({
      id: label._id.toString(),
      name: label.name,
      color: label.color,
      emailCount: statsMap.get(label._id.toString()) || 0
    }));
  }

  /**
   * Create a new label
   */
  static async createLabel(userId: string, labelData: CreateLabelData): Promise<any> {
    // Check if label name already exists for this user
    const existingLabel = await EmailLabel.findOne({
      userId,
      name: labelData.name
    });

    if (existingLabel) {
      throw new Error('Label with this name already exists');
    }

    const label = new EmailLabel({
      userId,
      name: labelData.name,
      color: labelData.color
    });

    await label.save();

    return {
      id: label._id.toString(),
      name: label.name,
      color: label.color,
      emailCount: 0
    };
  }

  /**
   * Update a label
   */
  static async updateLabel(labelId: string, userId: string, updates: any): Promise<any> {
    const label = await EmailLabel.findOne({ _id: labelId, userId });
    if (!label) {
      throw new Error('Label not found');
    }

    // Check for name conflicts if name is being updated
    if (updates.name && updates.name !== label.name) {
      const existingLabel = await EmailLabel.findOne({
        userId,
        name: updates.name,
        _id: { $ne: labelId }
      });

      if (existingLabel) {
        throw new Error('Label with this name already exists');
      }
    }

    Object.assign(label, updates);
    await label.save();

    return {
      id: label._id.toString(),
      name: label.name,
      color: label.color,
      emailCount: 0 // Would need to recalculate
    };
  }

  /**
   * Delete a label
   */
  static async deleteLabel(labelId: string, userId: string): Promise<void> {
    const label = await EmailLabel.findOne({ _id: labelId, userId });
    if (!label) {
      throw new Error('Label not found');
    }

    // Remove all label assignments
    await EmailLabelAssignment.deleteMany({ labelId });

    // Delete the label
    await EmailLabel.findByIdAndDelete(labelId);
  }

  /**
   * Add label to email
   */
  static async addLabelToEmail(emailId: string, labelId: string, userId: string): Promise<void> {
    // Verify label belongs to user
    const label = await EmailLabel.findOne({ _id: labelId, userId });
    if (!label) {
      throw new Error('Label not found');
    }

    // Check if assignment already exists
    const existingAssignment = await EmailLabelAssignment.findOne({
      emailId,
      labelId
    });

    if (existingAssignment) {
      return; // Already assigned
    }

    const assignment = new EmailLabelAssignment({
      emailId,
      labelId
    });

    await assignment.save();
  }

  /**
   * Remove label from email
   */
  static async removeLabelFromEmail(emailId: string, labelId: string, userId: string): Promise<void> {
    // Verify label belongs to user
    const label = await EmailLabel.findOne({ _id: labelId, userId });
    if (!label) {
      throw new Error('Label not found');
    }

    await EmailLabelAssignment.findOneAndDelete({
      emailId,
      labelId
    });
  }

  /**
   * Get labels for an email
   */
  static async getEmailLabels(emailId: string, userId: string): Promise<any[]> {
    const assignments = await EmailLabelAssignment.find({ emailId })
      .populate({
        path: 'labelId',
        match: { userId },
        select: 'name color'
      });

    return assignments
      .filter((assignment: any) => assignment.labelId) // Filter out labels that don't belong to user
      .map((assignment: any) => ({
        id: (assignment.labelId as any)._id.toString(),
        name: (assignment.labelId as any).name,
        color: (assignment.labelId as any).color
      }));
  }
}