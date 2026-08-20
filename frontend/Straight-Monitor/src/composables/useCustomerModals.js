import { useDockedModals } from '@bleck-it/vue-modal-dock';
import CustomerCard from '@/components/Modals/CustomerCard.vue';

function customerIdentity(customer) {
  return customer?._id ?? customer?.id ?? customer?.kundenNr;
}

export function getCustomerModalId(customer) {
  const identity = customerIdentity(customer);
  if (identity === undefined || identity === null || String(identity).trim() === '') {
    throw new Error('Eine Kundenkarte benötigt _id, id oder kundenNr.');
  }
  return `customer-${String(identity)}`;
}

export function getCustomerModalTitle(customer) {
  return String(
    customer?.kuerzel
      || customer?.kundName
      || customer?.kundenNr
      || 'Kunde'
  );
}

/**
 * Opens CustomerCard in the package-owned host mounted above RouterView.
 * Different customer IDs coexist; opening the same ID restores that instance.
 */
export function useCustomerModals() {
  const dockedModals = useDockedModals();

  function openCustomer(customer) {
    const id = getCustomerModalId(customer);
    const title = getCustomerModalTitle(customer);

    return dockedModals.open({
      id,
      title,
      component: CustomerCard,
      props: {
        kunde: customer,
        minimizeId: id,
        minimizeTitle: title,
        onClose: () => dockedModals.remove(id),
      },
    });
  }

  function closeCustomer(customerOrId) {
    const id = typeof customerOrId === 'string'
      ? customerOrId
      : getCustomerModalId(customerOrId);
    return dockedModals.remove(id);
  }

  return {
    dockedModals,
    openCustomer,
    closeCustomer,
  };
}
