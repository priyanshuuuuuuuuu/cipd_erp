import React from 'react';

const styles = {
    Input: {
        /* Removed absolute positioning (top, left) to make it responsive */
        width: '100%', /* Changed from fixed 363px to 100% of container */
        height: '53px',
        padding: '0px 16px', /* Increased padding slightly */
        border: '1.2px solid #00bfff',
        boxSizing: 'border-box',
        borderRadius: '14px',
        // opacity: 0.57, // Note: This makes the whole input transparent including text. Might want to apply to bg only? Keeping as requested.
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        color: '#000000',
        fontSize: '14px',
        fontFamily: 'DM Sans, sans-serif',
        lineHeight: '18px',
        outline: 'none',
        marginBottom: '10px',
    },
};

// Removed absolute positioning to allow flex layout integration
// top: '432px', left: '540px',

const defaultProps = {
    text: 'Enter your email address',
};

const InputField = (props) => {
    return (
        <input
            style={styles.Input}
            placeholder={props.text ?? defaultProps.text}
            type={props.type || 'text'}
            value={props.value}
            onChange={props.onChange}
        />
    );
};

export default InputField;
