import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import React, {useState} from 'react';
import WebView from 'react-native-webview';
import {COLORS} from '../../constants';
import {useDispatch} from 'react-redux';
import {CheckTransactionStatusApi} from '../../redux/actions/orderAction';

const PhonePayView = ({
  successCallback,
  errorCallback,
  url,
  visible,
  orderId,
}) => {
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  const timerRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const checkStatus = () => {
    dispatch(
      CheckTransactionStatusApi(orderId, (loader, success, data) => {
        setLoading(false);
        if (success == 'success') {
          // The PhonePe SDK getOrderStatus method returns `{ state: 'COMPLETED' | 'PENDING' | 'FAILED', ... }`
          if (data?.data?.state === 'COMPLETED') {
            successCallback && successCallback(data);
          } else if (data?.data?.state === 'PENDING') {
            // Retry after 2 seconds if pending
            timerRef.current = setTimeout(checkStatus, 2000);
            setLoading(true);
          } else {
            errorCallback && errorCallback('FAILED');
          }
        } else {
          if (data?.data?.state === 'PENDING') {
            timerRef.current = setTimeout(checkStatus, 2000);
            setLoading(true);
          } else {
            errorCallback && errorCallback('FAILED');
          }
        }
      }),
    );
  };

  const transactionCallBack = data => {
    if (data?.loading) {
      setLoading(true);
    } else {
      setLoading(false);
    }

    // Check if the URL contains the payment status page
    if (
      data?.url.includes('paymentstauspage') ||
      data?.url.includes('callback-url')
    ) {
      // Start polling or check status
      setLoading(true);
      checkStatus();
    }
  };

  return (
    <Modal
      visible={visible}
      style={{margin: 0}}
      onRequestClose={() => {
        Alert.alert(
          'Are you sure you want to cancel the payment?',
          'Your transaction will be canceled',
          [
            {
              text: 'Cancel',
              onPress: () => console.log('Cancel Pressed'),
              style: 'cancel',
            },
            {
              text: 'OK',
              onPress: () => errorCallback && errorCallback('CANCELLED'),
            },
          ],
        );
      }}>
      {visible && url && (
        <WebView
          style={styles.webview}
          source={{uri: url}}
          onNavigationStateChange={e => transactionCallBack(e)}
          renderLoading={() => (
            <View style={styles.box}>
              <ActivityIndicator size={'large'} color={COLORS.primary} />
            </View>
          )}
          startInLoadingState={true}
        />
      )}
    </Modal>
  );
};

export default PhonePayView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  box: {
    flex: 1,
    justifyContent: 'center', // center the loader in the screen
    alignItems: 'center',
  },
});
