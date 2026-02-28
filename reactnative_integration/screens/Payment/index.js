import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  BackHandler,
  FlatList,
} from 'react-native';
import Collapsible from 'react-native-collapsible';
import RazorpayCheckout from 'react-native-razorpay';
import React, {useEffect, useState} from 'react';
import styles from './styles';
import Modal from 'react-native-modal';
import {COLORS, icons, images} from '../../constants';
import {RadioButton} from 'react-native-paper';
import Button from '../../component/Button';
import {connect} from 'react-redux';
import {
  CreateOrderApi,
  UpdatetransactionIdApi,
  OpenPhonepayApi,
} from '../../redux/actions/orderAction';
import {http2, RAZORPAY_KEY} from '../../services/api';
import Loader from '../../component/modalLoading';
import Icons from '../../component/Icons';
import PaymentSuccessModal from '../../component/modal/PaymentSuccessModal';
import PhonePayView from '../../component/PhonePayView';
import {useFocusEffect} from '@react-navigation/native';
import {RNToasty} from 'react-native-toasty';
const {height, width} = Dimensions.get('window');

const Payment = ({
  route,
  navigation,
  CreateOrderApi,
  UpdatetransactionIdApi,
  getuser,
  getallcart,
  OpenPhonepayApi,
}) => {
  const [radio, setRadio] = useState(1);
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState();
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [isPhonePayModalVisible, setIsPhonePayModalVisible] = useState(false);

  const [isModalVisible, setModalVisible] = useState(false);

  // console.log("payment post : ", route?.params?.data)
  React.useLayoutEffect(() => {
    navigation?.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          style={styles.back_btn}
          onPress={() =>
            orderId ? navigation?.navigate('Booking') : navigation?.goBack()
          }>
          <Icons name={'back'} size={width * 0.08} color={COLORS.black} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, orderId]);

  const backAction = () => {
    if (orderId) {
      navigation?.navigate('Booking');
    } else {
      navigation?.goBack();
    }
    return true;
  };

  useFocusEffect(
    React.useCallback(() => {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction,
      );
      return () => backHandler.remove();
    }, [orderId]),
  );

  const Rozarpayonline = () => {
    const totalAmount = Number(route?.params?.data?.orderTotal);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      console.log(
        'Invalid orderTotal for Razorpay:',
        route?.params?.data?.orderTotal,
      );
      RNToasty.Error({
        title: 'Invalid payment amount. Please try again.',
      });
      return;
    }

    CreateOrderApi(
      {...route?.params?.data, paymentMethod: 'ONLINE'},
      (res, id, data) => {
        setLoading(data);
        console.log('Payment Rozarpayonline callback:', {
          res,
          id,
          loading: data,
        });
        if (res) {
          setOrderId(id);
          var options = {
            description: 'Payment for services',
            image:
              'https://easysolution.booksica.in/static/media/logo.f33c4633b780f8cf8053.png',
            currency: 'INR',
            key: RAZORPAY_KEY,
            amount: totalAmount * 100,
            name: 'Easy Solution Services',
            // order_id: id,
            prefill: {
              email: getuser?.email || '',
              contact: getuser?.phoneNumber || '',
              name: getuser?.fullName || getuser?.name || '',
            },
            theme: COLORS.primary,
          };
          console.log(
            'Opening Razorpay with options:',
            JSON.stringify(options, null, 2),
          );
          RazorpayCheckout.open(options)
            .then(data => {
              // handle success
              console.log(
                'Razorpay success data:',
                JSON.stringify(data, null, 2),
              );
              UpdatetransactionIdApi(
                id,
                data.razorpay_payment_id,
                (res, data) => {
                  setModalVisible(res), setLoading(data);
                },
              );
              console.log(`Success: ${data.razorpay_payment_id}`);
            })
            .catch(error => {
              // handle failure
              console.log(
                'Razorpay Error Callback:',
                JSON.stringify(error, null, 2),
              );

              let errorMessage = 'Payment Failed';

              // Specific check for cancellation
              if (
                error.code === 2 ||
                error.description === 'Payment cancelled by user' ||
                (typeof error.description === 'string' &&
                  error.description.includes('cancelled'))
              ) {
                errorMessage = 'Payment Cancelled';
              } else if (
                typeof error.description === 'string' &&
                !error.description.startsWith('{') &&
                error.description.length < 50
              ) {
                // Only use description if it's a short, non-JSON string
                errorMessage = error.description;
              }

              RNToasty.Error({
                title: errorMessage,
              });
            });
        } else if (!data) {
          console.log(
            'Razorpay Order Creation Failed - Callback negative and not loading',
          );
        }
      },
    );
  };

  const PaymentFun = () => {
    CreateOrderApi(
      {...route?.params?.data, paymentMethod: 'ONLINE'},
      (res, id, data) => {
        setLoading(data);

        // console.log(' data id...................', res)
        if (res) {
          setOrderId(id);

          OpenPhonepayApi(
            {
              orderId: id,
              amount: route?.params?.data?.orderTotal,
              mobileNumber: getuser?.phoneNumber,
              userId: getuser?._id,
            },
            (cl, response) => {
              const url =
                response?.data?.data?.instrumentResponse?.redirectInfo?.url;
              if (response?.success && url) {
                setPaymentUrl(url);
                setIsPhonePayModalVisible(true);
              } else if (!cl) {
                setLoading(false);
                RNToasty.Error({title: 'Failed to initiate PhonePe payment'});
              }
            },
          );
        }
      },
    );
  };

  const successPaymentCB = payload => {
    setIsPhonePayModalVisible(false);
    setPaymentUrl(null);

    const transId =
      payload?.data?.transactionId ||
      payload?.data?.merchantTransactionId ||
      `PHONEPE_${orderId}`;

    UpdatetransactionIdApi(orderId, transId, (res, data) => {
      setModalVisible(res);
      setLoading(data);
    });
  };

  const errorPaymentCB = status => {
    setIsPhonePayModalVisible(false);
    setPaymentUrl(null);
    const message =
      status === 'CANCELLED' ? 'Payment cancelled' : 'Payment failed';
    RNToasty.Error({title: message});
  };

  return (
    <ScrollView style={styles.container}>
      <Loader loading={loading} />
      <View style={{marginTop: height * 0.02, flex: 1}}>
        {getallcart?.cartData?.length > 0 ? (
          <>
            <View style={styles.productContainer}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              <FlatList
                data={getallcart?.cartData}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item?._id}
                renderItem={({item}) => (
                  <View style={styles.productCard}>
                    <Image
                      source={
                        item?.productId?.thumnail
                          ? {uri: http2 + item?.productId?.thumnail}
                          : images?.no_image
                      }
                      style={styles.productThumb}
                    />
                    <View style={styles.productInfo}>
                      <Text numberOfLines={1} style={styles.productTitle}>
                        {item?.productId?.title}
                      </Text>
                      <Text style={styles.productPrice}>
                        ₹{item?.productId?.price || item?.price}
                      </Text>
                    </View>
                  </View>
                )}
                contentContainerStyle={{paddingHorizontal: width * 0.04}}
              />
              <View style={styles.totalSummary}>
                <Text style={styles.totalText}>
                  Total Items: {getallcart?.cartData?.length}
                </Text>
                <Text style={styles.totalAmount}>
                  Payable: ₹{route?.params?.data?.orderTotal}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setRadio(1);
              }}
              style={styles.pymentBox}>
              <Image source={icons.Online} style={styles.pymtIcon} />
              <View style={{flex: 1}}>
                <Text style={styles.pymtname}>Pay with Razorpay</Text>
                <Text style={styles.pymtSubtitle}>Fast and Secure Payment</Text>
              </View>
              <View style={[styles.radioBox, {marginRight: width * 0.04}]}>
                {radio === 1 && <Text style={styles.radioInner}></Text>}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setRadio(2);
              }}
              style={styles.pymentBox}>
              <Image source={icons.Online} style={styles.pymtIcon} />
              <View style={{flex: 1}}>
                <Text style={styles.pymtname}>Pay with PhonePe</Text>
                <Text style={styles.pymtSubtitle}>
                  Safe and Instant Payment
                </Text>
              </View>
              <View style={[styles.radioBox, {marginRight: width * 0.04}]}>
                {radio === 2 && <Text style={styles.radioInner}></Text>}
              </View>
            </TouchableOpacity>

            {(radio === 1 || radio === 2) && (
              <Button
                t1={'Continue with Payment'}
                t2={styles.btn}
                onPress={() => {
                  if (radio === 1) {
                    Rozarpayonline();
                  } else {
                    PaymentFun();
                  }
                }}
              />
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Image source={images.cartEmpty} style={styles.emptyImage} />
            <Text style={styles.emptyTitle}>Cart is Empty</Text>
            <Text style={styles.emptySubtitle}>
              You don't have any items to pay for at the moment.
            </Text>
            <Button
              t1="Go Back Home"
              t2={{width: width * 0.6, alignSelf: 'center', borderRadius: 15}}
              onPress={() => navigation.navigate('Home')}
            />
          </View>
        )}

        <PaymentSuccessModal
          visible={isModalVisible}
          orderId={orderId}
          onchangeVisible={() => {
            setModalVisible(false);
            navigation?.navigate('Booking');
          }}
        />

        {paymentUrl && (
          <PhonePayView
            orderId={orderId}
            visible={isPhonePayModalVisible}
            url={paymentUrl}
            successCallback={successPaymentCB}
            errorCallback={errorPaymentCB}
          />
        )}
      </View>
    </ScrollView>
  );
};

const mapStateToProps = state => ({
  getallcart: state.cart.getallcart,
  getuser: state.auth.getuser,
});

const mapDispatchToProps = {
  CreateOrderApi,
  UpdatetransactionIdApi,
  OpenPhonepayApi,
};

export default connect(mapStateToProps, mapDispatchToProps)(Payment);
