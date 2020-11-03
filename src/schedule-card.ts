import { LitElement, html, customElement, property, CSSResult, TemplateResult, css, PropertyValues } from 'lit-element';
import {
  HomeAssistant,
  hasConfigOrEntityChanged,
  hasAction,
  ActionHandlerEvent,
  handleAction,
  LovelaceCardEditor,
  getLovelace
} from 'custom-card-helpers';

import { ScheduleCardConfig, ScheduleItem } from './types';
import { CARD_VERSION } from './const';

import { localize } from './localize/localize';

const MODES = {
  eco: { color: 'lightblue', label: 'Eco' },
  comfort: { color: 'red', label: 'Confort' },
  away: { color: 'green', label: 'Absent' }
};

const fetchSchedule = (hass, sid) =>
  hass.callWS({
    type: 'schedule_list/fetch',
    schedule_id: sid
  });

const updateSchedule = (hass, sid, s, e) =>
  hass.callWS({
    type: 'schedule_list/update',
    schedule_id: sid,
    data: { schedule: Object.assign([], s), entities: Object.assign([], e) }
  });

/* eslint no-console: 0 */
console.info(
  `%c  SCHEDULE-CARD \n%c  ${localize('common.version')} ${CARD_VERSION}  `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray'
);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'schedule-card',
  name: 'Schedule Card',
  description: 'A template custom card for you to create something awesome'
});

@customElement('schedule-card')
export class ScheduleCard extends LitElement {
  static getStubConfig(): object {
    return {};
  }

  // TODO Add any properities that should cause your element to re-render here
  @property() public hass!: HomeAssistant;
  @property() private _config!: ScheduleCardConfig;
  @property() private _select_start!: string;
  @property() private _hours!: Array<number>;
  @property() private _weekdays!: Array<string>;
  @property() private mode!: string;
  @property() private entities!: Array<string>;
  @property() private schedule!: Array<Array<ScheduleItem>>;

  constructor() {
    super();
    this._select_start = '';
    this._hours = [];
    this._weekdays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    for (let i = 0; i < 24; i += 0.5) {
      this._hours.push(i);
    }
    this.mode = 'comfort';
  }

  getCardSize(): number {
    return (this._config ? (this._config.title ? 1 : 0) : 0) + 3;
  }

  setConfig(config: ScheduleCardConfig): void {
    this._config = config;
    if (!config.id) {
      throw new Error('You need to define an id');
    }
    if (!config.title) {
      throw new Error('You need to define a title');
    }

    this._fetchData();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._fetchData();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  private render_entete(): TemplateResult {
    return html`
      ${this._hours.map((item, index: number) =>
        index % 2 == 0
          ? html`
              <div id="entete_${index}" class="item hours">${item}</div>
            `
          : html``
      )}
    `;
  }

  private render_hours(dindex: number): TemplateResult {
    return html`
      ${this._hours.map(
        (_, hindex) =>
          html`
            <div
              id="${dindex}-${hindex}"
              class="item"
              style="background-color: ${MODES[
                this.schedule[dindex][hindex].nval
                  ? this.schedule[dindex][hindex].nval
                  : this.schedule[dindex][hindex].cval
              ].color}"
              @click="${this._onclick}"
              @pointerenter="${this._onpointerenter}"
            />
          `
      )}
    `;
  }

  private render_weekday(): TemplateResult {
    return html`
      ${this._weekdays.map(
        (day, dindex) =>
          html`
            <div class="entete">${day}</div>
            ${this.render_hours(dindex)}
          `
      )}
    `;
  }

  render(): TemplateResult | void {
    if (!this._config || !this.hass || !this.schedule || !this.entities) {
      return html``;
    }
    console.log('render', this.entities);
    return html`
      <ha-card .header="${this._config.title}">
        <div class="wrapper">
          <div class="entete_h"></div>
          ${this.render_entete()}${this.render_weekday()}
        </div>
        <div>
          <label id="label2">Mode:</label>
          ${Object.keys(MODES).map(
            mode => html`
              <input
                type="radio"
                id="${mode}"
                name="mode"
                value="${mode}"
                @change="${this._modeSelected}"
                ?checked="${this.mode == mode}"
              />
              <label for="${mode}">${MODES[mode].label}</label>
            `
          )}
        </div>
        <div>
          <select size="3" @change="${this._onclick_thermostat}" multiple>
            ${this._getThermostat().map(
              name => html`
                <option value="${name}" ?selected="${this.entities.includes(name)}">${name}</option>
              `
            )}
          </select>
        </div>
      </ha-card>
    `;
  }
  /*
          <paper-dropdown-menu label="Thermostat">
            <paper-listbox
              slot="dropdown-content"
              multi
              attr-for-selected="itemname"
              .selectedValues=${this.entities}
              @click="${this._onclick_thermostat}"
            >
              ${this._getThermostat().map(
                name => html`
                  <paper-item itemname="${name}">${name}</paper-item>
                `
              )}
            </paper-listbox>
          </paper-dropdown-menu>


<select id="cars" name="cars" size="1">
    <option value="volvo">Volvo</option>
    <option value="saab">Saab</option>
    <option value="fiat">Fiat</option>
    <option value="audi">Audi</option>
  </select>*/

  static get styles(): CSSResult {
    return css`
      .wrapper {
        display: grid;
        grid-template-columns: auto repeat(48, 1fr);
        grid-gap: 1px;
      }

      .hours {
        font-size: 10px;
        grid-column-start: span 2;
      }
    `;
  }

  async _fetchData(): Promise<void> {
    if (this.hass) {
      const data = await fetchSchedule(this.hass, this._config.id);
      // update schedule and entities
      if (data.schedule) {
        this.entities = Object.assign([], data.entities);
        this.schedule = Object.assign([], data.schedule);
      } else if (!this.schedule && !this.entities) {
        this.schedule = Array(this._weekdays.length)
          .fill(0)
          .map(() =>
            Array(this._hours.length)
              .fill(0)
              .map(() => Object({ cval: 'eco', nval: '' }))
          );
        this.entities = [];
      }
    }
  }

  _updateData(): void {
    updateSchedule(this.hass, this._config.id, this.schedule, this.entities).catch(() => {
      console.log('updateSchedule.catch');
      this._fetchData();
    });
    console.log('save');
  }

  _getThermostat(): string[] {
    const thermostat: string[] = [];
    for (const state in this.hass.states) {
      if (state.startsWith('climate')) {
        thermostat.push(this.hass.states[state].entity_id);
      }
    }
    return thermostat;
  }

  _setScheduleMode(id, mode, type, schedule): void {
    const iday = parseInt(id.split('-')[0], 10);
    const ihours = parseInt(id.split('-')[1], 10);
    schedule[iday][ihours][type] = mode;
  }

  _setScheduleMode2(sid, eid, mode, type, schedule): void {
    let sday = parseInt(sid.split('-')[0], 10);
    let shour = parseInt(sid.split('-')[1], 10);
    let eday = parseInt(eid.split('-')[0], 10);
    let ehour = parseInt(eid.split('-')[1], 10);
    if (eday < sday) {
      const old = sday;
      sday = eday;
      eday = old;
    }
    if (ehour < shour) {
      const old = shour;
      shour = ehour;
      ehour = old;
    }
    for (let d = sday; d <= eday; d++) {
      for (let h = shour; h <= ehour; h++) {
        schedule[d][h][type] = mode;
      }
    }
  }

  _resetScheduleMode(schedule): void {
    schedule.forEach(function(row) {
      row.forEach(function(item) {
        item.nval = '';
      });
    });
  }

  _onclick(ev): void {
    if (ev) {
      if (this._select_start == '') {
        const id = ev.target.id;
        this._select_start = id;
        // copy array
        const newschedule = Object.assign([], this.schedule);
        this._setScheduleMode(id, this.mode, 'cval', newschedule);
        this.schedule = newschedule;
      } else {
        this._select_start = '';
        // validate selection
        const newschedule = Object.assign([], this.schedule);
        newschedule.forEach(function(row: Array<ScheduleItem>) {
          row.forEach(function(item) {
            if (item.nval) {
              item.cval = item.nval;
              item.nval = '';
            }
          });
        });
        this.schedule = newschedule;
        // save data
        this._updateData();
      }
    }
  }

  _onpointerenter(ev): void {
    if (this._select_start) {
      const eid = ev.target.id;
      const newschedule = Object.assign([], this.schedule);
      this._resetScheduleMode(newschedule);
      this._setScheduleMode2(this._select_start, eid, this.mode, 'nval', newschedule);
      this.schedule = newschedule;
    }
  }

  _modeSelected(ev): void {
    if (ev) {
      this.mode = ev.target.value;
    }
  }

  _onclick_thermostat(ev): void {
    if (ev) {
      // update entities selected
      console.log('_onclick_thermostat', ev.target.selectedOptions);
      const entities: string[] = [];
      for (const thermo of ev.target.selectedOptions) {
        entities.push(thermo.value);
      }
      console.log('_onclick_thermostat', entities);
      this.entities = entities;
      this._updateData();
    }
  }
}
