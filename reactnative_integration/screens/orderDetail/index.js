import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
} from 'react-native';
import React, {useState} from 'react';
import styles from './styles';
import OrderCard1 from '../../component/card/OrderCard1';
import {connect, useDispatch} from 'react-redux';
import {http2, RAZORPAY_KEY} from '../../services/api';
import {formattedDate3} from '../../services/date';
import {COLORS, SIZES, icons} from '../../constants';
import {viewFileFromUrl} from '../../services/fileSystem';
import {
  CancelBookingApi,
  GetOrderByIdApi,
  SendReturnRequestApi,
  UpdatetransactionIdApi,
  OpenPhonepayApi,
} from '../../redux/actions/orderAction';
import {Alert} from 'react-native';
import PhonePayView from '../../component/PhonePayView';
import PaymentSuccessModal from '../../component/modal/PaymentSuccessModal';
import RazorpayCheckout from 'react-native-razorpay';
import Loader from '../../component/modalLoading';
import Button from '../../component/Button';
import Modal from 'react-native-modal';
import Input1 from '../../component/input/Input1';
import OrderCancelModal from '../../component/modal/OrderCancelModal';
import {BottomSheet} from 'react-native-btr';
import Icons from '../../component/Icons';
import Stars from 'react-native-stars';
import {RNToasty} from 'react-native-toasty';
import {
  AddReviewApi,
  GetByProductIdApi,
} from '../../redux/actions/categoryAction';
const {height, width} = Dimensions.get('window');

const OrderDetail = ({
  navigation,
  getuser,
  SendReturnRequestApi,
  AddReviewApi,
  route,
  singleOrder,
  CancelBookingApi,
  UpdatetransactionIdApi,
  GetOrderByIdApi,
  GetByProductIdApi,
  OpenPhonepayApi,
}) => {
  // const orderData = singleOrder || null
  let product = route?.params?.pId
    ? singleOrder?.product?.find(i => i._id == route?.params?.pId) || null
    : singleOrder?.product?.[0];
  let pIndex = route?.params?.pId
    ? singleOrder?.product?.findIndex(i => i._id == route?.params?.pId)
    : 0;

  let arr = singleOrder?.product ? [...singleOrder?.product] : [];
  arr?.splice(pIndex, 1);

  const [reason, setReason] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [orderId, setOrderId] = useState();
  const [cancel, setCancel] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [isPhonePayModalVisible, setIsPhonePayModalVisible] = useState(false);

  const dispatch = useDispatch();

  const handleSubmit = () => {
    if (reason) {
      setModalVisible(false);
      CancelBookingApi(singleOrder?._id, {reason: reason}, (res, data) => {
        setLoading(data);
        setCancel(false);
        setReason('');
        if (res) {
          setCancelModal(true);
          // navigation?.navigate("Booking")
        }
      });
    } else {
      RNToasty.Error({
        title: 'Please write your reason',
      });
    }
  };

  const [errors, setErrors] = useState({
    rating: null,
    comment: null,
  });

  const [postData, setPostData] = useState({
    userId: getuser?._id || null,
    productId: product?.productId?._id || '',
    comment: '',
    rating: 0,
  });

  const handleChangeErrors = (name, value) => {
    setErrors({
      ...errors,
      [name]: value,
    });
  };

  const handleChange = (name, value) => {
    setPostData({
      ...postData,
      [name]: value,
    });
    if (name == 'rating') {
      handleChangeErrors(
        name,
        postData.rating ? null : 'Please add your rating',
      );
    } else {
      handleChangeErrors(
        name,
        postData.comment ? null : 'Please add your comment',
      );
    }
  };

  const handleSubmitReview = () => {
    if (postData.rating && postData.comment) {
      console.log('review data : ', postData);
      AddReviewApi(postData, navigation, data => setLoading(data));
      // setPostData({
      //     ...postData,
      //     comment: null,
      //     rating: 0,
      // })
    } else {
      if (!postData.rating) {
        RNToasty.Error({
          title: 'Please add your rating',
        });
      }
      setErrors({
        rating: postData.rating ? null : 'Please add your rating',
        comment: postData.comment ? null : 'Please write your comment',
      });
    }
  };

  let checkstatus = [
    'DELIVERED',
    'RETURN REQUEST',
    'RETURN REQUEST APPROVED',
    'RETURNED',
  ];

  const handlePhonePePayment = id => {
    setOrderId(id);
    OpenPhonepayApi(
      {
        orderId: id,
        amount: singleOrder?.orderDetails?.orderTotal,
        mobileNumber: singleOrder?.address?.mobile || getuser?.phoneNumber,
        userId: getuser?._id,
      },
      (cl, response) => {
        const url = response?.data?.data?.instrumentResponse?.redirectInfo?.url;
        if (response?.success && url) {
          setPaymentUrl(url);
          setIsPhonePayModalVisible(true);
        } else if (!cl) {
          RNToasty.Error({title: 'Failed to initiate PhonePe payment'});
        }
      },
    );
  };

  const successPaymentCB = payload => {
    setIsPhonePayModalVisible(false);

    const transId =
      payload?.data?.transactionId ||
      payload?.data?.merchantTransactionId ||
      `PHONEPE_${orderId || singleOrder?._id}`;

    UpdatetransactionIdApi(
      orderId || singleOrder?._id,
      transId,
      (res, data) => {
        setPaymentModal(res);
        setLoading(data);
      },
    );
    GetOrderByIdApi(orderId || singleOrder?._id);
  };

  const errorPaymentCB = status => {
    setIsPhonePayModalVisible(false);
    const message =
      status === 'CANCELLED' ? 'Payment cancelled' : 'Payment failed';
    RNToasty.Error({title: message});
  };

  const [isPaymentMethodModalVisible, setIsPaymentMethodModalVisible] =
    useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);

  const handlePaymentSelection = id => {
    setSelectedPaymentId(id);
    setIsPaymentMethodModalVisible(true);
  };

  const handleRazorpayPayment = id => {
    var options = {
      description: 'Order Payment',
      image:
        'https://easysolution.booksica.in/static/media/logo.f33c4633b780f8cf8053.png',
      currency: 'INR',
      key: RAZORPAY_KEY,
      amount: Number(singleOrder?.orderDetails?.orderTotal)?.toFixed(2) * 100,
      name: 'Easy Solution Services',
      // order_id: id,
      prefill: {
        email: getuser?.email || '',
        contact: singleOrder?.address?.mobile || '',
        name: getuser?.name || '',
      },
      theme: {color: COLORS.primary},
    };

    RazorpayCheckout.open(options)
      .then(data => {
        // Success callback
        console.log('Razorpay Success:', data);
        UpdatetransactionIdApi(
          singleOrder?._id,
          data?.razorpay_payment_id,
          (res, data) => {
            setPaymentModal(res);
            setLoading(data);
          },
        );
        GetOrderByIdApi(singleOrder?._id);
      })
      .catch(error => {
        // Error callback
        console.log('Razorpay Error:', error);
      });
  };

  // const order = singleOrder?.product?.slice(pIndex, pIndex+1)
  // console.log("order detail : ", singleOrder?.orderDetails)

  return (
    <View style={styles.container}>
      <Loader loading={loading} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={'handled'}>
        <OrderCard1
          disable={true}
          source={{uri: http2 + product?.productId?.thumnail}}
          title={product?.productId?.title}
          orderNo={product?._id}
          date={formattedDate3(singleOrder?.createdAt)}
          status={product?.status}
          subtitle={product?.productId?.subtitle}
          // deliveryDate={'Not Available'}
          paymentMode={singleOrder?.paymentMethod}
          imagePress={() =>
            GetByProductIdApi(product?.productId?._id, navigation, data =>
              setLoading(data),
            )
          }
        />
        {/* {singleOrder?.orderDetails?.status == "PENDING" &&
                    <PhonepeCheckoutTouch style={styles.t2}
                        // amount={Number(singleOrder?.orderDetails?.orderTotal)?.toFixed(2) * 100} //required
                        merchantId={"M22Q3CHJHEYP0"} //required
                        saltKey={"09d82f66-8de2-4a23-8502-cbc4f1856030"} //required
                        saltIndex={1} //default "1"
                        amount={Number(singleOrder?.orderDetails?.orderTotal)?.toFixed(2) * 100} //required
                        callback={`https://api.essindiaonline.com/api/PhonePayGatewayStatus?merchantTransactionId=1&orderId=2`} //required
                        redirectUrl={"https://essindiaonline.com/paymentstauspage"} //required
                        merchantUserId={"USER_ID"} //required
                        successCallback={(data) => {
                            UpdatetransactionIdApi(singleOrder?._id, data?.transactionId, (res, data) => { setPaymentModal(res), setLoading(data) })
                            GetOrderByIdApi(id)
                            console.log("success data : ", data)
                        }}
                        errorCallback={(data) => {
                            // navigation?.navigate("Booking")
                            console.log("error data : ", data)
                        }}

                    // uat={true} //default false for production usage. Mark true for UAT testing
                    >
                        <Text style={styles.text16}>Pay Now</Text>
                    </PhonepeCheckoutTouch>
                } */}
        {singleOrder?.orderDetails?.status == 'PENDING' && (
          <TouchableOpacity
            style={styles.t2}
            onPress={() => handlePaymentSelection(singleOrder?._id)}>
            <Text style={styles.text16}>Pay Now</Text>
          </TouchableOpacity>
        )}

        {singleOrder?.orderDetails?.status == 'DELIVERED' && (
          <TouchableOpacity
            activeOpacity={0.5}
            style={[styles.t2, {borderRadius: 8}]}
            onPress={() =>
              SendReturnRequestApi(
                product?.productId?._id,
                singleOrder?._id,
                navigation,
                data => setLoading(data),
              )
            }>
            {/* <Icons name={'return'} size={width * .06} color={COLORS.white} /> */}
            <Text style={styles.text16}>Return</Text>
          </TouchableOpacity>
        )}

        {arr?.map((item, index) => (
          <OrderCard1
            key={item?._id}
            source={{uri: http2 + item?.productId?.thumnail}}
            title={item?.productId?.title}
            orderNo={item?._id}
            date={formattedDate3(singleOrder?.createdAt)}
            status={item?.status}
            subtitle={item.productId?.subtitle}
            // deliveryDate={'Not Available'}
            paymentMode={singleOrder?.paymentMethod}
            onPress={() =>
              navigation?.navigate('OrderDetail', {pId: item?._id})
            }
            imagePress={() =>
              GetByProductIdApi(item?.productId?._id, navigation, data =>
                setLoading(data),
              )
            }
          />
        ))}

        {/* price details */}
        <View style={styles.card}>
          <Text style={styles.title}>Price Details</Text>
          <View style={styles.row}>
            <Text style={styles.key}>Price</Text>
            <Text style={styles.value}>
              ₹{singleOrder?.orderDetails?.netAmount}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>Delivery Charge</Text>
            <Text style={[styles.value, {color: COLORS.success}]}>
              Free Delivery
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>Coupons Discount</Text>
            <Text style={styles.value}>
              ₹
              {singleOrder?.orderDetails?.totalOfferDiscount
                ? singleOrder?.orderDetails?.totalOfferDiscount
                : 0}
            </Text>
          </View>
          <View style={styles.row2}>
            <Text style={styles.key1}>Total Amount</Text>
            <Text style={styles.value1}>
              ₹{singleOrder?.orderDetails?.orderTotal}
            </Text>
          </View>
        </View>

        {/* address box */}
        <View style={styles.card}>
          <View style={styles.loc_row}>
            <Image source={icons.location} style={styles.location} />
            <Text style={styles.title2}>Address</Text>
          </View>

          <Text style={styles.name}>
            {singleOrder?.address?.firstName} {singleOrder?.address?.lastName}
          </Text>
          <Text
            style={
              styles.address
            }>{`${singleOrder?.address?.address}, ${singleOrder?.address?.apartment}, ${singleOrder?.address?.area}, ${singleOrder?.address?.city}, ${singleOrder?.address?.landmark}, ${singleOrder?.address?.country}, ${singleOrder?.address?.state}, ${singleOrder?.address?.pinCode}`}</Text>
          <Text style={styles.name}>
            Phone no:{' '}
            <Text style={styles.address}>{singleOrder?.address?.mobile}</Text>
          </Text>
        </View>

        <View style={styles.row1}>
          {product?.status != 'CANCELLED' && (
            <TouchableOpacity
              activeOpacity={0.5}
              style={styles.btn1}
              onPress={() =>
                navigation.navigate('Tracking', {status: product?.status})
              }>
              <Text style={styles.btn1_text}>Track Order</Text>
            </TouchableOpacity>
          )}
        </View>

        {checkstatus?.includes(product?.status) && (
          <View style={styles.review_box}>
            <Text style={styles.review}>Review</Text>
            <View style={styles.star_row}>
              <Stars
                display={postData?.rating}
                count={5}
                spacing={SIZES.width * 0.02}
                // half={true}
                fullStar={
                  <Icons
                    name={'star-fill'}
                    size={SIZES.width * 0.07}
                    color={COLORS.yellow}
                  />
                }
                emptyStar={
                  <Icons
                    name={'star-outline'}
                    size={SIZES.width * 0.07}
                    color={'#9B9B9B'}
                  />
                }
                // halfStar={<Icons name={'star-half'} size={SIZES.width * .07} color={COLORS.yellow} />}
                update={val => handleChange('rating', val)}
                // disabled={true}
              />
            </View>

            <Input1
              placeholder={'write your comment'}
              multiline={true}
              inputTextStyle={{width: width * 0.92}}
              numberOfLines={5}
              value={postData.comment}
              onChangeText={text => handleChange('comment', text)}
              error={errors.comment}
            />
            <Button
              t2={{marginBottom: SIZES.height * 0.02, width: width * 0.45}}
              onPress={handleSubmitReview}
              t1={'Submit'}
            />
          </View>
        )}
      </ScrollView>

      {singleOrder?.orderDetails?.status != 'PENDING' && (
        <View style={styles.cancel_row}>
          {singleOrder?.orderDetails?.status != 'PENDING' &&
            singleOrder?.orderDetails?.status != 'CANCELLED' &&
            singleOrder?.orderDetails?.status != 'RETURNED' && (
              <>
                {singleOrder?.orderDetails?.status == 'ORDERED' && (
                  <TouchableOpacity
                    style={styles.cancelbtn}
                    onPress={() => setModalVisible(true)}>
                    <Text style={styles.text1}>Cancel Order</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.t12,
                    singleOrder?.orderDetails?.status == 'ORDERED'
                      ? {width: width * 0.43}
                      : {width: width * 0.9},
                  ]}
                  onPress={() =>
                    viewFileFromUrl(
                      http2 + singleOrder?.invoice,
                      'download',
                      data => setLoading(data),
                    )
                  }>
                  <Text style={styles.text16}>Download Invoice</Text>
                </TouchableOpacity>
              </>
            )}
        </View>
      )}

      <PaymentSuccessModal
        visible={paymentModal}
        orderId={orderId}
        onchangeVisible={() => {
          setPaymentModal(false);
          navigation?.navigate('Booking');
        }}
      />

      {paymentUrl && (
        <PhonePayView
          orderId={orderId || singleOrder?._id}
          visible={isPhonePayModalVisible}
          url={paymentUrl}
          successCallback={successPaymentCB}
          errorCallback={errorPaymentCB}
          navigation={navigation}
        />
      )}

      <OrderCancelModal
        visible={cancelModal}
        onchangeVisible={() => {
          setCancelModal(false);
          navigation?.navigate('Booking');
        }}
      />

      {/* cancel booking modal */}
      <BottomSheet
        visible={isModalVisible}
        onBackButtonPress={() => {
          setCancel(false), setReason(''), setModalVisible(false);
        }}
        onBackdropPress={() => {
          setCancel(false), setReason(''), setModalVisible(false);
        }}>
        <View style={styles.modalstyle}>
          <View>
            <Text style={styles.text6}>
              {cancel ? 'Reason' : 'Cancel Order'}
            </Text>
            <View style={styles.line}></View>
          </View>
          {cancel ? (
            <Input1
              placeholder={'reason'}
              multiline={true}
              numberOfLines={5}
              inputTextStyle={{marginTop: SIZES.height * 0.025}}
              value={reason}
              onChangeText={text => setReason(text)}
            />
          ) : (
            <>
              <Text style={styles.text4}>
                Are you sure want to cancel your order ?
              </Text>
              <Text style={[styles.text4, {color: COLORS.grey}]}>
                Only 80% of the money you can refund from your payment according
                to our policy
              </Text>
            </>
          )}
          <View style={styles.line}></View>
          {cancel ? (
            <View style={styles.modal_box2}>
              <Button t1={'Confirm'} t2={styles.btn} onPress={handleSubmit} />
            </View>
          ) : (
            <View style={styles.modal_box2}>
              <Button
                t1={'Cancel'}
                t2={styles.modalcanclebtn}
                t3={{color: COLORS.primary}}
                onPress={() => setModalVisible(false)}
              />
              <Button
                t1={'Yes, Cancel Order'}
                t2={styles.btn}
                t3={{fontSize: 12}}
                onPress={() => setCancel(true)}
              />
            </View>
          )}
        </View>
      </BottomSheet>

      {/* Payment Method Modal */}
      <Modal
        isVisible={isPaymentMethodModalVisible}
        onBackButtonPress={() => setIsPaymentMethodModalVisible(false)}
        onBackdropPress={() => setIsPaymentMethodModalVisible(false)}
        style={{margin: 0, justifyContent: 'flex-end'}}>
        <View
          style={{
            backgroundColor: COLORS.white,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
          }}>
          <Text
            style={{
              fontFamily: 'Poppins-SemiBold',
              fontSize: 18,
              color: COLORS.black,
              marginBottom: 5,
            }}>
            Payment Method
          </Text>
          <Text
            style={{
              fontFamily: 'Poppins-Regular',
              fontSize: 13,
              color: COLORS.grey,
              marginBottom: 20,
            }}>
            Choose your preferred payment gateway
          </Text>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 15,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.lightGray,
            }}
            onPress={() => {
              setIsPaymentMethodModalVisible(false);
              setTimeout(() => handlePhonePePayment(selectedPaymentId), 500);
            }}>
            <Image
              source={icons.phonepe}
              style={{
                width: 40,
                height: 40,
                resizeMode: 'contain',
                marginRight: 15,
              }}
            />
            <Text
              style={{
                fontFamily: 'Poppins-Medium',
                fontSize: 16,
                color: COLORS.black,
              }}>
              PhonePe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 15,
            }}
            onPress={() => {
              setIsPaymentMethodModalVisible(false);
              setTimeout(() => handleRazorpayPayment(selectedPaymentId), 500);
            }}>
            <Image
              source={icons.razorpay}
              style={{
                width: 40,
                height: 40,
                resizeMode: 'contain',
                marginRight: 15,
              }}
            />
            <Text
              style={{
                fontFamily: 'Poppins-Medium',
                fontSize: 16,
                color: COLORS.black,
              }}>
              Razorpay
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              marginTop: 20,
              paddingVertical: 12,
              backgroundColor: COLORS.lightGray,
              borderRadius: 8,
              alignItems: 'center',
            }}
            onPress={() => setIsPaymentMethodModalVisible(false)}>
            <Text
              style={{
                fontFamily: 'Poppins-Medium',
                fontSize: 16,
                color: COLORS.black,
              }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const mapStateToProps = state => ({
  token: state.auth.token,
  getuser: state.auth.getuser,
  singleOrder: state.order.singleOrder,
});

const mapDispatchToProps = {
  CancelBookingApi,
  UpdatetransactionIdApi,
  GetOrderByIdApi,
  AddReviewApi,
  SendReturnRequestApi,
  GetByProductIdApi,
  OpenPhonepayApi,
};

export default connect(mapStateToProps, mapDispatchToProps)(OrderDetail);
