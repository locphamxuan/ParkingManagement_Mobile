import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePackages } from '../../hooks/usePackages';
import { usePackageSubscription } from '../../hooks/usePackageSubscription';
import { usePackageCancellation } from '../../hooks/usePackageCancellation';
import { usePackageRenewal } from '../../hooks/usePackageRenewal';
import { PackageFilterBar } from '../../components/packages/PackageFilterBar';
import { PackagesStatusView } from '../../components/packages/PackagesStatusView';
import { BrowsePackagesList } from '../../components/packages/BrowsePackagesList';
import { MySubscriptionsList } from '../../components/packages/MySubscriptionsList';
import { SubscribeModal } from '../../components/packages/SubscribeModal';
import { CancelSubscriptionModal } from '../../components/packages/CancelSubscriptionModal';
import { RenewSubscriptionModal } from '../../components/packages/RenewSubscriptionModal';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/packages';

export default function PackagesScreen() {
  const {
    token, plates,
    activeTab, setActiveTab,
    prefillPlateNumber,
    packages, subscriptions, loading, refreshing, error,
    expandedBuildings, setExpandedBuildings,
    searchQuery, setSearchQuery, vehicleFilter, setVehicleFilter,
    durationFilter, setDurationFilter, statusFilter, setStatusFilter,
    expandedFilter, setExpandedFilter, load,
    filteredPackages, groups, filteredSubscriptions,
  } = usePackages();

  const subscription = usePackageSubscription({
    token,
    plates,
    prefillPlateNumber,
    onSubscribed: () => {
      setActiveTab('my');
      load(true);
    },
  });

  const cancellation = usePackageCancellation({
    token,
    onCancelled: () => load(true),
  });

  const renewal = usePackageRenewal({
    token,
    onRenewed: () => load(true),
  });

  const isBrowseTab = activeTab === 'browse';
  const isEmpty = isBrowseTab ? packages.length === 0 : subscriptions.length === 0;
  const isFilteredEmpty = isBrowseTab ? filteredPackages.length === 0 : filteredSubscriptions.length === 0;
  const isInitialLoading = loading && isEmpty;

  const handleClearFilters = () => {
    setSearchQuery('');
    setVehicleFilter('all');
    setDurationFilter('all');
    setStatusFilter('all');
    setExpandedFilter(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>Long-term Packages</Text>
            <Text style={styles.headerTitle}>All Buildings</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => load(true)}>
            <Ionicons name="refresh" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <PackageFilterBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          vehicleFilter={vehicleFilter}
          setVehicleFilter={setVehicleFilter}
          durationFilter={durationFilter}
          setDurationFilter={setDurationFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          expandedFilter={expandedFilter}
          setExpandedFilter={setExpandedFilter}
        />

        {/* Body */}
        {isInitialLoading ? (
          <PackagesStatusView kind="loading" activeTab={activeTab} onRetry={() => load()} onClearFilters={handleClearFilters} />
        ) : error ? (
          <PackagesStatusView kind="error" activeTab={activeTab} error={error} onRetry={() => load()} onClearFilters={handleClearFilters} />
        ) : isEmpty ? (
          <PackagesStatusView kind="empty" activeTab={activeTab} onRetry={() => load()} onClearFilters={handleClearFilters} />
        ) : isFilteredEmpty ? (
          <PackagesStatusView kind="empty-filtered" activeTab={activeTab} onRetry={() => load()} onClearFilters={handleClearFilters} />
        ) : isBrowseTab ? (
          <BrowsePackagesList
            groups={groups}
            expandedBuildings={expandedBuildings}
            setExpandedBuildings={setExpandedBuildings}
            refreshing={refreshing}
            onRefresh={() => load(true)}
            onSubscribe={subscription.handleOpenSubscribe}
          />
        ) : (
          <MySubscriptionsList
            subscriptions={filteredSubscriptions}
            refreshing={refreshing}
            onRefresh={() => load(true)}
            onCancel={cancellation.openCancel}
            onRenew={renewal.openRenew}
          />
        )}
      </View>

      {/* Subscribe Package Purchase Modal */}
      {subscription.selectedPkg && (
        <SubscribeModal
          pkg={subscription.selectedPkg}
          token={token}
          matchedPlates={subscription.matchedPlatesFor(subscription.selectedPkg)}
          selectedPlate={subscription.selectedPlate}
          setSelectedPlate={subscription.setSelectedPlate}
          floors={subscription.floors}
          selectedFloorId={subscription.selectedFloorId}
          onSelectFloor={subscription.handleSelectFloor}
          slots={subscription.slots}
          fetchingSlots={subscription.fetchingSlots}
          selectedSlot={subscription.selectedSlot}
          onSelectSlot={subscription.setSelectedSlot}
          showMapModal={subscription.showMapModal}
          setShowMapModal={subscription.setShowMapModal}
          viewMode={subscription.viewMode}
          setViewMode={subscription.setViewMode}
          purchasing={subscription.purchasing}
          purchaseErr={subscription.purchaseErr}
          purchaseSuccessMsg={subscription.purchaseSuccessMsg}
          onClose={subscription.closeModal}
          onConfirm={subscription.handleConfirmSubscribe}
        />
      )}

      {/* Cancel Subscription Modal */}
      {cancellation.cancellingSub && (
        <CancelSubscriptionModal
          sub={cancellation.cancellingSub}
          cancelReason={cancellation.cancelReason}
          setCancelReason={cancellation.setCancelReason}
          cancelNote={cancellation.cancelNote}
          setCancelNote={cancellation.setCancelNote}
          cancelling={cancellation.cancelling}
          cancelErr={cancellation.cancelErr}
          onClose={cancellation.closeCancel}
          onConfirm={cancellation.handleConfirmCancel}
        />
      )}

      {/* Renew Subscription Modal */}
      {renewal.renewingSub && (
        <RenewSubscriptionModal
          sub={renewal.renewingSub}
          renewing={renewal.renewing}
          renewErr={renewal.renewErr}
          onClose={renewal.closeRenew}
          onConfirm={renewal.handleConfirmRenew}
        />
      )}
    </SafeAreaView>
  );
}
