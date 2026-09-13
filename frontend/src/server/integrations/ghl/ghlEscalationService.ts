import { ConversationIntent } from '../../domain/conversational/conversationalTypes';
import { ghlClient } from './ghlClient';

const REASON_TAGS: Partial<Record<ConversationIntent, string>> = {
  booking_request: 'tb_booking_request',
  availability_query: 'tb_booking_request',
  booking_confirm: 'tb_booking_change',
  booking_cancel: 'tb_booking_cancel',
};

export const GhlEscalationService = {
  async escalate({
    contactId,
    reason,
    locationToken,
  }: {
    contactId: string;
    reason: ConversationIntent;
    locationToken?: string;
  }): Promise<string[]> {
    if (!contactId) throw new Error('GHL escalation: contactId mancante');

    const tags = ['tb_human_escalation', 'tb_needs_reception'];
    const reasonTag = REASON_TAGS[reason];
    if (reasonTag) tags.push(reasonTag);

    await ghlClient.addTags(
      contactId,
      tags,
      locationToken || process.env.GHL_LOCATION_TOKEN
    );
    return tags;
  },
};
