import React from 'react';

const styles = {
    Text: {
        color: '#000000ff',
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif',
        lineHeight: '16px',
        textAlign: 'right',
        opacity: 0.57,
        marginTop: '10px',
        cursor: 'pointer',
        textDecoration: 'none',
        display: 'block',
        width: '100%',
    },
};

const defaultProps = {
    text: 'Forgot your password?',
};

const ForgotPasswordText = (props) => {
    return (
        <a href="#" style={styles.Text}>
            {props.text ?? defaultProps.text}
        </a>
    );
};

export default ForgotPasswordText;
