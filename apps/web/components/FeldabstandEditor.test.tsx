// @vitest-environment jsdom
import { render,fireEvent,cleanup } from '@testing-library/react';
import { afterEach,it,expect,vi } from 'vitest';
import { MODULES,type FelderInput } from '@pv-belegung/engine';
import { FeldabstandEditor } from './FeldabstandEditor';
afterEach(cleanup);
const input:FelderInput={module:MODULES[0]!,breiteM:30,hoeheM:30,montage:{aufstaenderung:'ostwest',winkelDeg:10,pitchM:3}};
const feld={xM:0,yM:0,breiteM:10,hoeheM:10,quer:true,freieGasseM:.05};
it('übernimmt eigene Gasse ausdrücklich, akzeptiert Dezimalkomma und bietet Flächenvorgabe',()=>{
 const onAendern=vi.fn(),ui=render(<FeldabstandEditor input={input} felder={[feld]} onAendern={onAendern}/>);
 fireEvent.change(ui.getByLabelText('Freie Gasse im ausgewählten Feld'),{target:{value:'1,2'}});expect(onAendern).not.toHaveBeenCalled();
 fireEvent.click(ui.getByText('Abstand übernehmen'));expect(onAendern).toHaveBeenLastCalledWith(1.2);
 fireEvent.click(ui.getByText('Flächenvorgabe verwenden'));expect(onAendern).toHaveBeenLastCalledWith(undefined);
});
it.each(['','abc','-1','51'])('verhindert ungültige Gasse %s mit sichtbarer Hilfe',wert=>{
 const onAendern=vi.fn(),ui=render(<FeldabstandEditor input={input} felder={[feld]} onAendern={onAendern}/>);
 fireEvent.change(ui.getByLabelText('Freie Gasse im ausgewählten Feld'),{target:{value:wert}});fireEvent.click(ui.getByText('Abstand übernehmen'));
 expect(onAendern).not.toHaveBeenCalled();expect(ui.getByRole('alert')).toBeTruthy();
});
it('zeigt gemischte Gassen bei Mehrfachauswahl ohne gemeinsamen falschen Wert',()=>{
 const ui=render(<FeldabstandEditor input={input} felder={[feld,{...feld,freieGasseM:1.2}]} onAendern={vi.fn()}/>);
 expect(ui.getByPlaceholderText('Verschiedene Abstände')).toBeTruthy();
});
