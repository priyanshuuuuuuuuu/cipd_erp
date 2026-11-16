import React from 'react';

const styles = {
    Text: {
        color: '#030303',
        fontSize: '24px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 700,
        lineHeight: '32px',
        // opacity: 0.57,
        margin: '0 0 20px',
        textAlign: 'left',
    },
};

const defaultProps = {
    text: 'Welcome Back!',
};

const WelcomeText = (props) => {
    return (
        <h1 style={styles.Text}>
            {props.text ?? defaultProps.text}
        </h1>
    );
};

export default WelcomeText;
