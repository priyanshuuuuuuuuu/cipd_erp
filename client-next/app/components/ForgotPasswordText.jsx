import React from 'react';

const styles = {
    Text: {
        color: '#888888',
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif',
        lineHeight: '16px',
        textAlign: 'right',
        opacity: 0.8,
        marginTop: '10px',
        display: 'block',
        width: '100%',
    },
};

const defaultProps = {
    text: 'Forgot your password? Contact your administrator.',
};

const ForgotPasswordText = (props) => {
    return (
        <span style={styles.Text}>
            {props.text ?? defaultProps.text}
        </span>
    );
};

export default ForgotPasswordText;
