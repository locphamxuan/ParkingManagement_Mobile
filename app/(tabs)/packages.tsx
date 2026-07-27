import { useEffect, useRef } from 'react';
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
    prefillPlateNumber, prefillPackageId,
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

  // Auto-open the Subscribe modal for a specific package when navigated here
  // with ?packageId=... (Home screen's package card tap) instead of just
  // landing on the generic Browse tab with the tap having no visible effect.
  const packageAutoOpened = useRef(false);
  useEffect(() => {
    if (packageAutoOpened.current || !prefillPackageId || packages.length === 0) return;
    const match = packages.find((pkg) => pkg._id === prefillPackageId);
    if (match) {
      setActiveTab('browse');
      subscription.handleOpenSubscribe(match);
    }
    packageAutoOpened.current = true;
  }, [prefillPackageId, packages, subscription, setActiveTab]);

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
          <View style={styles.headerCopy}>
            <Text style={styles.headerLabel}>Long-term Packages</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>All Buildings</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => load(true)}
            accessibilityRole="button"
            accessibilityLabel="Refresh packages"
          >
            <Ionicons name="refresh" size={20} color={Colors.primary} />
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
          cancelSuccessMsg={cancellation.cancelSuccessMsg}
          refundPreview={cancellation.refundPreview}
          loadingPreview={cancellation.loadingPreview}
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
          needsReplacement={renewal.renewNeedsReplacement}
          onClose={renewal.closeRenew}
          onConfirm={renewal.handleConfirmRenew}
          onChooseReplacement={() => {
            renewal.closeRenew();
            setActiveTab('browse');
          }}
        />
      )}
    </SafeAreaView>
  );
}
