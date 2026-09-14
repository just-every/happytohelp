import React, {useEffect, useState, useRef} from 'react';
import autosize from 'autosize';

export default function TextareaAutosize(props) {
    const KEY_CODE_ENTER = 13;
    const KEY_CODE_SHIFT = 16;
    const KEY_CODE_CTRL = 17;

    const [chars, setChars] = useState(0);
    const pressedKeys = useRef({});

    useEffect(() => {
        autosize(props.forwardRef.current);
        return () => {
            // Cleanup autosize
            autosize.destroy(props.forwardRef.current);
        };
    }, [props.forwardRef]);

    useEffect(() => {
        // Ensure textarea resizes when value updates
        autosize.update(props.forwardRef.current);
    }, [props.forwardRef, props.value]);

    const {forwardRef, onChange, onEnter, ...forwardProps} = {...props};

    const onChangeChars = event => {
        setChars(event.target.value.length);
        if(onChange) {
            onChange(event);
        }
    }

    const onKeyDown = event => {
        if(event.keyCode) {
            pressedKeys.current[event.keyCode] = true;
        }
        if ((event.key === 'Enter' || event.keyCode === KEY_CODE_ENTER) && !pressedKeys.current[KEY_CODE_SHIFT] && !pressedKeys.current[KEY_CODE_CTRL] && onEnter) {
            onEnter(event);
        }
    }

    const onKeyUp = event => {
        if(event.keyCode) {
            delete pressedKeys.current[event.keyCode];
        }
    }

    var msg = null;
    if(props.maxLength && chars >= props.maxLength) {
        msg = <div className="desc error">
            You've hit the maximum length of {props.maxLength} characters for this field.
        </div>;
    }

    return (
        <span>
                <textarea
                    ref={forwardRef}
                    {...forwardProps}
                    onChange={onChangeChars}
                    onKeyDown={onKeyDown}
                    onKeyUp={onKeyUp} />
            {msg}
            </span>

    );
}
