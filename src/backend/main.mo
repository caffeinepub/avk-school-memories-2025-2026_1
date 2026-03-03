import Map "mo:core/Map";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // Initialize the access control system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);
  include MixinStorage();

  // Core Data Types
  type PhotoMetadata = {
    id : Text;
    title : ?Text;
    uploadTimestamp : Time.Time;
    blob : Storage.ExternalBlob;
  };

  module PhotoMetadata {
    public func fromNewPhoto(id : Text, title : ?Text, blob : Storage.ExternalBlob) : PhotoMetadata {
      {
        id;
        title;
        uploadTimestamp = Time.now();
        blob;
      };
    };
  };

  public type UserProfile = {
    name : Text;
    userId : Text;
  };

  let photos = Map.empty<Text, PhotoMetadata>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  // Admin authentication with fixed credentials
  let adminId = "20695943";
  let adminPassword = "koushik@0705";

  // Session token storage (simple implementation)
  let sessions = Map.empty<Text, Principal>();

  // Helper to generate session token
  func generateSessionToken(principal : Principal) : Text {
    let timestamp = Time.now();
    principal.toText() # "-" # Int.toText(timestamp);
  };

  // Authentication - Public endpoint
  public func login(providedId : Text, providedPassword : Text) : async Text {
    if (providedId == adminId and providedPassword == adminPassword) {
      // For the fixed admin, we'll use a special principal representation
      // In a real system, this would be the caller's principal after proper authentication
      let adminPrincipal = Principal.fromText("aaaaa-aa"); // Placeholder
      let token = generateSessionToken(adminPrincipal);
      sessions.add(token, adminPrincipal);
      token;
    } else {
      Runtime.trap("Unauthorized: Invalid credentials");
    };
  };

  // User Profile Management
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Public: List all photos (no authorization required)
  public query ({ caller }) func listAllPhotos() : async [PhotoMetadata] {
    photos.values().toArray();
  };

  // Admin-only: Upload photo
  public shared ({ caller }) func uploadPhoto(id : Text, title : ?Text, blob : Storage.ExternalBlob) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can upload photos");
    };
    photos.add(id, PhotoMetadata.fromNewPhoto(id, title, blob));
  };

  // Admin-only: Delete photo
  public shared ({ caller }) func deletePhoto(photoId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete photos");
    };
    if (not photos.containsKey(photoId)) { 
      Runtime.trap("Photo not found") 
    };
    photos.remove(photoId);
  };
};
