import { Fragment } from 'react';
import { Icon } from '../../homepage/drawings/Icons';

const steps = ['Your details', 'Workspace', 'Review'];

/** Where the owner is in setup: a done step's number turns into a check, and the current step is a filled aqua disc. The pen line
 *  between two steps is its own decorative item so it can give way to the labels when the column is narrow. */
export default function SetupSteps({ step }: { step: number }) {
    return <nav className="setup-steps-nav" aria-label="Setup progress"><ol className="setup-steps">{steps.map((label, index) => <Fragment key={label}>
        {index > 0 && <li className="setup-step-line" aria-hidden="true" />}
        <li className={index < step ? 'is-done' : undefined} aria-current={step === index ? 'step' : undefined}>
            <span className="setup-step-disc">{index < step ? <><Icon name="check" /><span className="setup-hidden">Completed: </span></> : index + 1}</span>{label}
        </li>
    </Fragment>)}</ol></nav>;
}
