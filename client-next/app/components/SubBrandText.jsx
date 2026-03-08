import React from 'react';

const styles = {
    Text: {
        color: '#000000ff',
        fontSize: '14px',
        fontFamily: 'Manrope, sans-serif',
        fontWeight: '500',
        lineHeight: '19px',
        marginTop: '5px',
    },
};

const defaultProps = {
    text: 'Sign in to your CiPD 360 ERP',
};

const SubBrandText = (props) => {
    return (
        <div style={styles.Text}>
            {props.text ?? defaultProps.text}
        </div>
    );
};

export default SubBrandText;
