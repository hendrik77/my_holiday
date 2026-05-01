import { useState } from 'react';
import { useUpdateSettings } from '../api/hooks';
import { GERMAN_STATES } from '../data/holidays';
import type { GermanState } from '../data/holidays';
import { useT } from '../i18n/useT';
import './Modal.css';

interface Props {
  onClose: () => void;
}

const TOTAL_STEPS = 4;

export function FirstRunWizard({ onClose }: Props) {
  const { t } = useT();
  const updateSettings = useUpdateSettings();

  const [step, setStep] = useState(0);

  const [emplStart, setEmplStart] = useState('');
  const [emplEnd, setEmplEnd] = useState('');
  const [stillEmployed, setStillEmployed] = useState(true);
  const [selectedState, setSelectedState] = useState<GermanState>('HE');
  const [days, setDays] = useState('30');
  const [deadline, setDeadline] = useState('03-31');
  const [maxCarryOver, setMaxCarryOver] = useState('');
  const [noCarryOverCap, setNoCarryOverCap] = useState(true);

  const canGoBack = step > 0;
  const isLastStep = step === TOTAL_STEPS - 1;

  const handleNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleFinish = () => {
    updateSettings.mutate({
      employmentStartDate: emplStart,
      employmentEndDate: stillEmployed ? '' : emplEnd,
      state: selectedState,
      totalDays: parseInt(days, 10) || 30,
      carryOverDeadline: deadline,
      carryOverMaxDays: noCarryOverCap ? null : (parseInt(maxCarryOver, 10) || null),
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal wizard-modal">
        <div className="modal-header">
          <h3>{t('firstRun.title')}</h3>
          <div className="wizard-steps">
            {step + 1} / {TOTAL_STEPS}
          </div>
        </div>

        <div className="modal-body">
          {step === 0 && (
            <div className="wizard-step">
              <h4 className="wizard-step-title">{t('firstRun.step1')}</h4>
              <div className="form-group">
                <label className="form-label">{t('employment.startDate')}</label>
                <input
                  type="date"
                  className="form-input"
                  value={emplStart}
                  onChange={(e) => setEmplStart(e.target.value)}
                />
              </div>
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={stillEmployed}
                  onChange={(e) => setStillEmployed(e.target.checked)}
                />
                <span>{t('employment.stillEmployed')}</span>
              </label>
              {!stillEmployed && (
                <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                  <label className="form-label">{t('employment.endDate')}</label>
                  <input
                    type="date"
                    className="form-input"
                    value={emplEnd}
                    onChange={(e) => setEmplEnd(e.target.value)}
                  />
                  <div className="form-hint">{t('employment.endDateHint')}</div>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="wizard-step">
              <h4 className="wizard-step-title">{t('firstRun.step2')}</h4>
              <div className="form-group">
                <label className="form-label">Bundesland</label>
                <select
                  className="form-input"
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value as GermanState)}
                >
                  {GERMAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {t(`states.${s.code}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step">
              <h4 className="wizard-step-title">{t('firstRun.step3')}</h4>
              <div className="form-group">
                <label className="form-label">{t('settings.daysPerYear')}</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-step">
              <h4 className="wizard-step-title">{t('firstRun.step4')}</h4>
              <div className="form-group">
                <label className="form-label">{t('carryOverPolicy.deadlineLabel')}</label>
                <select
                  className="form-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                >
                  <option value="03-31">{t('carryOverPolicy.mar31')}</option>
                  <option value="06-30">{t('carryOverPolicy.jun30')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('carryOverPolicy.maxCapLabel')}</label>
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={noCarryOverCap}
                    onChange={(e) => setNoCarryOverCap(e.target.checked)}
                  />
                  <span>{t('carryOverPolicy.noCap')}</span>
                </label>
                {!noCarryOverCap && (
                  <input
                    type="number"
                    className="form-input"
                    min={0}
                    max={60}
                    value={maxCarryOver}
                    onChange={(e) => setMaxCarryOver(e.target.value)}
                    style={{ marginTop: 'var(--space-sm)' }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer wizard-footer">
          <div>
            {canGoBack && (
              <button className="btn btn-secondary" onClick={handleBack}>
                {t('firstRun.back')}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {isLastStep ? (
              <button className="btn btn-primary" onClick={handleFinish}>
                {t('firstRun.finish')}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleNext}>
                {t('firstRun.next')}
              </button>
            )}
          </div>
        </div>

        <p className="wizard-hint">{t('firstRun.hint')}</p>
      </div>
    </div>
  );
}
