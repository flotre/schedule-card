import { ActionConfig, LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from 'custom-card-helpers';

declare global {
  interface HTMLElementTagNameMap {
    'schedule-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

// Add your configuration elements here for type-checking
export interface ScheduleCardConfig extends LovelaceCardConfig {
  id: string;
  title: string;
}

export interface ScheduleItem {
  cval: string;
  nval: string;
}
