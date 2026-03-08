import React from 'react';

const styles = {
    Text: {
        color: '#030303',
        fontSize: '24px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 700,
        lineHeight: '32px',
        // opacity: 0.57,
        marginBottom: '20px',
        textAlign: 'left',
    },
};

const defaultProps = {
    text: 'Welcome Back!',
};

const WelcomeText = (props) => {
    return (
        <div style={styles.Text}>
            {props.text ?? defaultProps.text}
        </div>
    );
};

export default WelcomeText;
