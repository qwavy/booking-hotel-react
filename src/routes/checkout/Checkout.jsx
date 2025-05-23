import React, { useContext, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import FinalBookingSummary from './components/final-booking-summary/FinalBookingSummary';
import { getReadableMonthFormat } from 'utils/date-helpers';
import { AuthContext } from 'contexts/AuthContext';
import { networkAdapter } from 'services/NetworkAdapter';
import Loader from 'components/ux/loader/loader';
import Toast from 'components/ux/toast/Toast';

/* ---------- Zod-схема ---------- */
const checkoutSchema = z.object({
  email: z.string().email(),
  nameOnCard: z.string().min(1, 'Required'),
  cardNumber: z.string().regex(/^\d{16}$/, 'Must be 16 digits'),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'MM/YY'),
  cvc: z.string().regex(/^\d{3,4}$/, '3–4 digits'),
  address: z.string().min(1, 'Required'),
  city: z.string().min(1, 'Required'),
  state: z.string().min(1, 'Required'),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'ZIP or ZIP-4'),
});

const Checkout = () => {
  const { isAuthenticated, userDetails } = useContext(AuthContext);

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [toastMessage, setToastMessage] = useState('');
  const [paymentConfirmation, setPaymentConfirmation] = useState({
    isLoading: false,
    data: {},
  });

  /* ---------- react-hook-form ---------- */
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: userDetails?.email || '',
      nameOnCard: '',
      cardNumber: '',
      expiry: '',
      cvc: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
    },
  });

  /* ---------- даты для итоговой карточки ---------- */
  const checkInDateTime = `${getReadableMonthFormat(
    searchParams.get('checkIn')
  )}, ${location.state?.checkInTime}`;

  const checkOutDateTime = `${getReadableMonthFormat(
    searchParams.get('checkOut')
  )}, ${location.state?.checkOutTime}`;

  /* ---------- проверка корректности входящих параметров ---------- */
  useEffect(() => {
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    if (!location.state || !checkIn || !checkOut) {
      const hotelCode = searchParams.get('hotelCode');
      navigate(`/hotel/${hotelCode}`);
    }
  }, [location.state, searchParams, navigate]);

  /* ---------- отправка формы ---------- */
  const onSubmit = async (formData) => {
    setPaymentConfirmation({ isLoading: true, data: {} });

    const response = await networkAdapter.post(
      '/api/payments/confirmation',
      formData
    );

    if (response && response.data && response.errors.length === 0) {
      setPaymentConfirmation({ isLoading: false, data: response.data });
      reset();
      const hotelName = searchParams.get('hotelName').replaceAll('-', '_');
      navigate(`/booking-confirmation?payment=success&hotel=${hotelName}`, {
        state: { confirmationData: response.data },
      });
    } else {
      setPaymentConfirmation({ isLoading: false, data: {} });
      setToastMessage('Payment failed. Please try again.');
    }
  };

  /* ---------- классы для инпутов ---------- */
  const inputClass = (hasError) =>
    `shadow appearance-none border ${
      hasError ? 'border-red-500' : 'border-gray-300'
    } rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none`;

  return (
    <div className="flex flex-col items-center">
      {/* ----- итоговое резюме бронирования ----- */}
      <FinalBookingSummary
        hotelName={searchParams.get('hotelName').replaceAll('-', ' ')}
        checkIn={checkInDateTime}
        checkOut={checkOutDateTime}
        isAuthenticated={isAuthenticated}
        phone={userDetails?.phone}
        email={userDetails?.email}
        fullName={userDetails?.fullName}
      />

      <div className="relative bg-white border shadow-md rounded px-8 pt-6 pb-8 mb-4 w-full max-w-lg">
        {paymentConfirmation.isLoading && (
          <Loader isFullScreen loaderText="Payment in progress, hold tight!" />
        )}

        {/* ----- форма ----- */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className={paymentConfirmation.isLoading ? 'opacity-40' : ''}
        >
          {/* Email */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-bold mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              aria-invalid={!!errors.email}
              {...register('email')}
              className={inputClass(!!errors.email)}
            />
            {errors.email && (
              <p className="text-red-500 text-xs my-1">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Name on card */}
          <div className="mb-4">
            <label
              htmlFor="nameOnCard"
              className="block text-sm font-bold mb-2"
            >
              Name on card
            </label>
            <input
              id="nameOnCard"
              type="text"
              placeholder="Name as it appears on card"
              aria-invalid={!!errors.nameOnCard}
              {...register('nameOnCard')}
              className={inputClass(!!errors.nameOnCard)}
            />
            {errors.nameOnCard && (
              <p className="text-red-500 text-xs my-1">
                {errors.nameOnCard.message}
              </p>
            )}
          </div>

          {/* Card number */}
          <div className="mb-4">
            <label
              htmlFor="cardNumber"
              className="block text-sm font-bold mb-2"
            >
              Card number
            </label>
            <input
              id="cardNumber"
              type="text"
              placeholder="0000 0000 0000 0000"
              aria-invalid={!!errors.cardNumber}
              {...register('cardNumber')}
              className={inputClass(!!errors.cardNumber)}
            />
            {errors.cardNumber && (
              <p className="text-red-500 text-xs my-1">
                {errors.cardNumber.message}
              </p>
            )}
          </div>

          {/* Expiry & CVC */}
          <div className="flex justify-between">
            <div className="mb-4 w-[48%]">
              <label htmlFor="expiry" className="block text-sm font-bold mb-2">
                Expiration date (MM/YY)
              </label>
              <input
                id="expiry"
                type="text"
                placeholder="MM/YY"
                aria-invalid={!!errors.expiry}
                {...register('expiry')}
                className={inputClass(!!errors.expiry)}
              />
              {errors.expiry && (
                <p className="text-red-500 text-xs my-1">
                  {errors.expiry.message}
                </p>
              )}
            </div>
            <div className="mb-4 w-[48%]">
              <label htmlFor="cvc" className="block text-sm font-bold mb-2">
                CVC
              </label>
              <input
                id="cvc"
                type="text"
                placeholder="CVC"
                aria-invalid={!!errors.cvc}
                {...register('cvc')}
                className={inputClass(!!errors.cvc)}
              />
              {errors.cvc && (
                <p className="text-red-500 text-xs my-1">
                  {errors.cvc.message}
                </p>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="mb-4">
            <label htmlFor="address" className="block text-sm font-bold mb-2">
              Address
            </label>
            <input
              id="address"
              type="text"
              placeholder="Street Address"
              aria-invalid={!!errors.address}
              {...register('address')}
              className={inputClass(!!errors.address)}
            />
            {errors.address && (
              <p className="text-red-500 text-xs my-1">
                {errors.address.message}
              </p>
            )}
          </div>

          {/* City */}
          <div className="mb-4">
            <label htmlFor="city" className="block text-sm font-bold mb-2">
              City
            </label>
            <input
              id="city"
              type="text"
              placeholder="City"
              aria-invalid={!!errors.city}
              {...register('city')}
              className={inputClass(!!errors.city)}
            />
            {errors.city && (
              <p className="text-red-500 text-xs my-1">{errors.city.message}</p>
            )}
          </div>

          {/* State & Postal code */}
          <div className="flex justify-between">
            <div className="mb-4 w-[48%]">
              <label htmlFor="state" className="block text-sm font-bold mb-2">
                State / Province
              </label>
              <input
                id="state"
                type="text"
                placeholder="State"
                aria-invalid={!!errors.state}
                {...register('state')}
                className={inputClass(!!errors.state)}
              />
              {errors.state && (
                <p className="text-red-500 text-xs my-1">
                  {errors.state.message}
                </p>
              )}
            </div>
            <div className="mb-4 w-[48%]">
              <label
                htmlFor="postalCode"
                className="block text-sm font-bold mb-2"
              >
                Postal code
              </label>
              <input
                id="postalCode"
                type="text"
                placeholder="Postal Code"
                aria-invalid={!!errors.postalCode}
                {...register('postalCode')}
                className={inputClass(!!errors.postalCode)}
              />
              {errors.postalCode && (
                <p className="text-red-500 text-xs my-1">
                  {errors.postalCode.message}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`bg-brand text-white font-bold py-2 px-4 rounded w-full transition ${
              isSubmitting
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-blue-700'
            }`}
          >
            Pay ₹ {location.state?.total}
          </button>
        </form>

        {toastMessage && (
          <div className="my-4">
            <Toast
              message={toastMessage}
              type="error"
              dismissError={() => setToastMessage('')}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
