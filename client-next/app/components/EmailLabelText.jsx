import React from 'react';

const styles = {
    Text: {
        color: '#030303',
        fontSize: '14px',
        fontFamily: 'Poppins, sans-serif',
        fontWeight: 500,
        lineHeight: '16px',
        // opacity: 0.57,
        marginBottom: '8px',
        textAlign: 'left',
    },
};

const defaultProps = {
    text: 'Email',
};

const EmailLabelText = (props) => {
    return (
        <label style={{ display: 'block', ...styles.Text }}>
            {props.text ?? defaultProps.text}
        </label>
    );
};

export default EmailLabelText;
